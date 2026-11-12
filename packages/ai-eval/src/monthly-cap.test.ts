import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { MONTHLY_CAP_USD } from './budget-limits.js'
import { assertWithinMonthlyCap, getMonthSpentUsd } from './monthly-cap.js'

const NOW = new Date('2026-11-12T10:00:00.000Z')

let dir = ''
const makeDir = async (
	ledgers: Record<string, { at: string; spentUsd: number }[]>,
): Promise<URL> => {
	dir = await mkdtemp(join(tmpdir(), 'monthly-'))
	for (const [stage, runs] of Object.entries(ledgers)) {
		const spentUsd = runs.reduce((sum, run) => sum + run.spentUsd, 0)
		const ledger = { capUsd: 4, spentUsd, runs: runs.map((run) => ({ cases: 1, ...run })) }
		await writeFile(join(dir, `eval-budget-${stage}.json`), JSON.stringify(ledger))
	}
	await writeFile(join(dir, 'notes.md'), 'not a ledger')
	return pathToFileURL(`${dir}/`)
}

afterEach(async () => {
	if (dir) await rm(dir, { recursive: true, force: true })
	dir = ''
})

describe('getMonthSpentUsd', () => {
	it('sums the runs of the current UTC month over all ledgers and skips other months', async () => {
		const target = await makeDir({
			'0.11.4': [
				{ at: '2026-11-03T10:00:00.000Z', spentUsd: 0.5 },
				{ at: '2026-10-31T23:59:59.000Z', spentUsd: 9 },
			],
			'0.11.5': [{ at: '2026-11-11T14:00:00.000Z', spentUsd: 0.25 }],
			'0.10.0': [{ at: '2025-11-05T10:00:00.000Z', spentUsd: 7 }],
		})

		expect(await getMonthSpentUsd(NOW, target)).toBeCloseTo(0.75)
	})

	it('is zero when there are no ledgers', async () => {
		expect(await getMonthSpentUsd(NOW, await makeDir({}))).toBe(0)
	})

	it('is zero when the folder does not exist', async () => {
		expect(await getMonthSpentUsd(NOW, pathToFileURL(join(tmpdir(), 'no-such-ledger-dir/')))).toBe(
			0,
		)
	})
})

describe('assertWithinMonthlyCap', () => {
	it('lets a run through while spent + reserve fit into the month cap', async () => {
		const target = await makeDir({ a: [{ at: '2026-11-02T10:00:00.000Z', spentUsd: 2.5 }] })

		await expect(
			assertWithinMonthlyCap({ reserveUsd: 0.5, isOverMonthAllowed: false, now: NOW, dir: target }),
		).resolves.toBeUndefined()
	})

	it('refuses a run that would pass the cap and says how much is spent', async () => {
		const target = await makeDir({ a: [{ at: '2026-11-02T10:00:00.000Z', spentUsd: 2.85 }] })

		await expect(
			assertWithinMonthlyCap({ reserveUsd: 0.3, isOverMonthAllowed: false, now: NOW, dir: target }),
		).rejects.toThrow(/Місячний ліміт eval: витрачено \$2\.85 з \$3\.00.*--allow-over-month/)
	})

	it('lets the same run through with --allow-over-month', async () => {
		const target = await makeDir({ a: [{ at: '2026-11-02T10:00:00.000Z', spentUsd: 2.85 }] })

		await expect(
			assertWithinMonthlyCap({ reserveUsd: 0.3, isOverMonthAllowed: true, now: NOW, dir: target }),
		).resolves.toBeUndefined()
	})

	it('does not count another month against the cap', async () => {
		const target = await makeDir({
			a: [{ at: '2026-10-02T10:00:00.000Z', spentUsd: MONTHLY_CAP_USD }],
		})

		await expect(
			assertWithinMonthlyCap({ reserveUsd: 0.3, isOverMonthAllowed: false, now: NOW, dir: target }),
		).resolves.toBeUndefined()
	})
})
