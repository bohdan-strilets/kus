import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export const LEDGER_DIR = new URL('../data/private/', import.meta.url)
export const SOFT_STOP_SHARE = 0.8
const STAGE_NAME_PATTERN = /^[\w.-]+$/

export interface LedgerRun {
	at: string
	/** How many ids --only had; the ids themselves may be private and are never stored. */
	only?: number
	cases: number
	spentUsd: number
	stoppedAt80?: boolean
}

export interface StageLedger {
	capUsd: number
	spentUsd: number
	runs: LedgerRun[]
}

export const getRemainingUsd = (ledger: StageLedger): number => ledger.capUsd - ledger.spentUsd

/** Hard cap of one run: --max-cost, narrowed by what is left of the stage. */
export const getEffectiveCapUsd = (maxCostUsd: number, ledger: StageLedger): number =>
	Math.min(maxCostUsd, getRemainingUsd(ledger))

/** Soft-stop threshold for spent + reserved of this run: 80 % of the stage, minus earlier runs. */
export const getSoftStopUsd = (ledger: StageLedger): number =>
	SOFT_STOP_SHARE * ledger.capUsd - ledger.spentUsd

export const addRun = (ledger: StageLedger, run: LedgerRun): StageLedger => ({
	...ledger,
	spentUsd: ledger.spentUsd + run.spentUsd,
	runs: [...ledger.runs, run],
})

export const getLedgerFile = (stage: string, dir: URL = LEDGER_DIR): URL => {
	if (!STAGE_NAME_PATTERN.test(stage))
		throw new Error('--stage may contain only letters, digits, . _ -')
	return new URL(`eval-budget-${stage}.json`, dir)
}

export const writeFileAtomic = async (file: URL, content: string): Promise<void> => {
	const target = fileURLToPath(file)
	const temp = `${target}.${process.pid}.tmp`
	await writeFile(temp, content)
	await rename(temp, target)
}

const isNotFound = (error: unknown): boolean =>
	error instanceof Error && 'code' in error && error.code === 'ENOENT'

const isLedger = (value: unknown): value is StageLedger =>
	typeof value === 'object' &&
	value !== null &&
	'capUsd' in value &&
	typeof value.capUsd === 'number' &&
	'spentUsd' in value &&
	typeof value.spentUsd === 'number' &&
	'runs' in value &&
	Array.isArray(value.runs)

export const loadLedger = async (
	stage: string,
	dir: URL = LEDGER_DIR,
): Promise<StageLedger | null> => {
	const file = getLedgerFile(stage, dir)
	const text = await readFile(file, 'utf8').catch((error: unknown) => {
		if (isNotFound(error)) return null
		throw error
	})
	if (text === null) return null
	const json: unknown = JSON.parse(text)
	if (!isLedger(json)) throw new Error(`eval-budget-${stage}.json has an unexpected shape`)
	return json
}

export const saveLedger = async (
	stage: string,
	ledger: StageLedger,
	dir: URL = LEDGER_DIR,
): Promise<void> => {
	await mkdir(dir, { recursive: true })
	await writeFileAtomic(getLedgerFile(stage, dir), JSON.stringify(ledger, null, '\t'))
}

export const createLedger = async (stage: string, capUsd: number): Promise<StageLedger> => {
	if (!Number.isFinite(capUsd) || capUsd <= 0)
		throw new Error('--stage-cap must be a positive number')
	const exists = await stat(getLedgerFile(stage)).then(
		() => true,
		(error: unknown) => {
			if (isNotFound(error)) return false
			throw error
		},
	)
	if (exists)
		throw new Error(`Ledger for stage ${stage} already exists: --stage-cap creates it once`)
	const ledger: StageLedger = { capUsd, spentUsd: 0, runs: [] }
	await saveLedger(stage, ledger)
	return ledger
}
