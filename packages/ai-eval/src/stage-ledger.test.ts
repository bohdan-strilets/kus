import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import {
	addRun,
	getEffectiveCapUsd,
	getLedgerFile,
	getSoftStopUsd,
	type StageLedger,
	writeFileAtomic,
} from './stage-ledger.js'
import { planStageRun } from './stage-run.js'

const ledger = (spentUsd: number, capUsd = 4): StageLedger => ({ capUsd, spentUsd, runs: [] })

describe('ledger math', () => {
	it('takes the smaller of --max-cost and what is left', () => {
		expect(getEffectiveCapUsd(3, ledger(0))).toBe(3)
		expect(getEffectiveCapUsd(3, ledger(2))).toBe(2)
	})

	it('puts the soft stop at 80 % of the stage minus earlier spend', () => {
		expect(getSoftStopUsd(ledger(0))).toBeCloseTo(3.2)
		expect(getSoftStopUsd(ledger(1))).toBeCloseTo(2.2)
	})

	it('adds a run to the spend without mutating the ledger', () => {
		const before = ledger(1)
		const after = addRun(before, { at: 'now', cases: 3, spentUsd: 0.5, only: 2 })
		expect(after.spentUsd).toBeCloseTo(1.5)
		expect(after.runs).toHaveLength(1)
		expect(before.runs).toHaveLength(0)
	})

	it('refuses to plan a run when nothing is left', () => {
		expect(() => planStageRun(ledger(4), { maxCostUsd: 3, isPast80: false })).toThrow()
		expect(() => planStageRun(ledger(5), { maxCostUsd: 3, isPast80: false })).toThrow()
	})

	it('drops the soft stop with --past-80 but keeps the narrowed hard cap', () => {
		const plan = planStageRun(ledger(3.5), { maxCostUsd: 3, isPast80: true })
		expect(plan.softStopUsd).toBeUndefined()
		expect(plan.capUsd).toBeCloseTo(0.5)
	})

	it('rejects stage names that could leave the folder', () => {
		expect(() => getLedgerFile('../x')).toThrow()
		expect(getLedgerFile('0.10.2').pathname).toMatch(/eval-budget-0\.10\.2\.json$/)
	})
})

describe('writeFileAtomic', () => {
	let dir = ''
	afterEach(async () => {
		if (dir) await rm(dir, { recursive: true, force: true })
	})

	it('replaces the content and leaves no temp file', async () => {
		dir = await mkdtemp(join(tmpdir(), 'ledger-'))
		const file = pathToFileURL(join(dir, 'l.json'))
		await writeFileAtomic(file, 'one')
		await writeFileAtomic(file, 'two')

		expect(await readFile(join(dir, 'l.json'), 'utf8')).toBe('two')
		expect(await readdir(dir)).toEqual(['l.json'])
	})
})
