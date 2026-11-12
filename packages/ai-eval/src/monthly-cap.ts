import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { MONTHLY_CAP_USD } from './budget-limits.js'
import { LEDGER_DIR } from './stage-ledger.js'

const LEDGER_NAME_PATTERN = /^eval-budget-.+\.json$/
const MONTH_LENGTH = 7

/** "2026-11" of an ISO timestamp or a Date, in UTC. */
export const getMonthKey = (moment: string | Date): string =>
	(moment instanceof Date ? moment.toISOString() : moment).slice(0, MONTH_LENGTH)

const isRunList = (value: unknown): value is { at: string; spentUsd: number }[] =>
	Array.isArray(value) &&
	value.every(
		(run: unknown) =>
			typeof run === 'object' &&
			run !== null &&
			'at' in run &&
			typeof run.at === 'string' &&
			'spentUsd' in run &&
			typeof run.spentUsd === 'number',
	)

const isNotFound = (error: unknown): boolean =>
	error instanceof Error && 'code' in error && error.code === 'ENOENT'

/**
 * Sum of runs[].spentUsd of all stage ledgers whose run started in the current calendar month (UTC).
 * No separate state file: the ledgers are the only source of truth.
 */
export const getMonthSpentUsd = async (
	now: Date = new Date(),
	dir: URL = LEDGER_DIR,
): Promise<number> => {
	const month = getMonthKey(now)
	const names = await readdir(fileURLToPath(dir)).catch((error: unknown) => {
		if (isNotFound(error)) return []
		throw error
	})
	let total = 0
	for (const name of names.filter((n) => LEDGER_NAME_PATTERN.test(n))) {
		const json: unknown = JSON.parse(await readFile(fileURLToPath(new URL(name, dir)), 'utf8'))
		const runs: unknown =
			typeof json === 'object' && json !== null && 'runs' in json ? json.runs : []
		if (!isRunList(runs)) throw new Error(`${name} has an unexpected shape of runs`)
		for (const run of runs) if (getMonthKey(run.at) === month) total += run.spentUsd
	}
	return total
}

export const monthlyCapMessage = (spentUsd: number, reserveUsd: number, month: string): string =>
	`Місячний ліміт eval: витрачено $${spentUsd.toFixed(2)} з $${MONTHLY_CAP_USD.toFixed(2)} (${month}), а цей прогін резервує ще до $${reserveUsd.toFixed(2)}. Eval не стартує. Дозволити понад ліміт може лише автор явним «так»: додай --allow-over-month.`

/** Refuses a paid run that could push the month past the cap, unless the author allowed it explicitly. */
export const assertWithinMonthlyCap = async (options: {
	reserveUsd: number
	isOverMonthAllowed: boolean
	now?: Date
	dir?: URL
}): Promise<void> => {
	const now = options.now ?? new Date()
	const spentUsd = await getMonthSpentUsd(now, options.dir)
	if (spentUsd + options.reserveUsd <= MONTHLY_CAP_USD || options.isOverMonthAllowed) return
	throw new Error(monthlyCapMessage(spentUsd, options.reserveUsd, getMonthKey(now)))
}
