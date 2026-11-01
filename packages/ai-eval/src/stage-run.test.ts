import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { loadLedger, type StageLedger } from './stage-ledger.js'
import { createLedgerRecorder } from './stage-run.js'

const BASE: StageLedger = { capUsd: 4, spentUsd: 1, runs: [] }
const AT = '2026-11-01T10:00:00.000Z'

let dir = ''
const makeDir = async (): Promise<URL> => {
	dir = await mkdtemp(join(tmpdir(), 'ledger-run-'))
	return pathToFileURL(`${dir}/`)
}

afterEach(async () => {
	if (dir) await rm(dir, { recursive: true, force: true })
	dir = ''
})

describe('createLedgerRecorder', () => {
	it('has the stage total equal to the finished cases after every case, without finish()', async () => {
		const target = await makeDir()
		const recorder = createLedgerRecorder('t', BASE, { at: AT, only: 3 }, target)

		await recorder.recordCase(0.1)
		expect((await loadLedger('t', target))?.spentUsd).toBeCloseTo(1.1)
		await recorder.recordCase(0.25)

		const ledger = await loadLedger('t', target)
		expect(ledger?.spentUsd).toBeCloseTo(1.35)
		expect(ledger?.runs).toHaveLength(1)
		expect(ledger?.runs[0]).toMatchObject({ at: AT, only: 3, cases: 2 })
		expect(ledger?.runs[0]?.spentUsd).toBeCloseTo(0.35)
	})

	it('keeps the ledger consistent when cases finish in parallel', async () => {
		const target = await makeDir()
		const recorder = createLedgerRecorder('t', BASE, { at: AT }, target)

		await Promise.all(Array.from({ length: 12 }, () => recorder.recordCase(0.5)))

		const ledger = await loadLedger('t', target)
		expect(ledger?.spentUsd).toBeCloseTo(7)
		expect(ledger?.runs[0]?.cases).toBe(12)
		expect(await readdir(dir)).toEqual(['eval-budget-t.json'])
	})

	it('marks the soft stop on finish and does not change the base ledger', async () => {
		const target = await makeDir()
		const recorder = createLedgerRecorder('t', BASE, { at: AT }, target)
		await recorder.recordCase(0.2)

		await recorder.finish({ isStoppedAt80: true })

		const ledger = await loadLedger('t', target)
		expect(ledger?.runs).toHaveLength(1)
		expect(ledger?.runs[0]).toMatchObject({ cases: 1, stoppedAt80: true })
		expect(BASE.runs).toHaveLength(0)
		expect(BASE.spentUsd).toBe(1)
	})

	it('records a run of zero cases on finish', async () => {
		const target = await makeDir()
		const recorder = createLedgerRecorder('t', BASE, { at: AT }, target)

		await recorder.finish({ isStoppedAt80: false })

		const ledger = await loadLedger('t', target)
		expect(ledger?.spentUsd).toBe(1)
		expect(ledger?.runs).toEqual([{ at: AT, cases: 0, spentUsd: 0 }])
	})
})
