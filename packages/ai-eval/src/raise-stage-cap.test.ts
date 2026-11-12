import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { DEFAULT_MAX_COST_USD, DEFAULT_STAGE_CAP_USD, MONTHLY_CAP_USD } from './budget-limits.js'
import { withDefaultStageCap } from './cli-guards.js'
import { addRun, createLedger, loadLedger, raiseStageCap } from './stage-ledger.js'

const NOW = new Date('2026-11-12T10:00:00.000Z')

let dir = ''
const makeDir = async (): Promise<URL> => {
	dir = await mkdtemp(join(tmpdir(), 'raise-cap-'))
	return pathToFileURL(`${dir}/`)
}

afterEach(async () => {
	if (dir) await rm(dir, { recursive: true, force: true })
	dir = ''
})

describe('defaults', () => {
	it('are 0.30 per release and per run, 3 USD per month', () => {
		expect(DEFAULT_STAGE_CAP_USD).toBe(0.3)
		expect(DEFAULT_MAX_COST_USD).toBe(0.3)
		expect(MONTHLY_CAP_USD).toBe(3)
	})

	it('creates a ledger with the default cap when no cap is given', async () => {
		const target = await makeDir()

		const ledger = await createLedger('r1', undefined, target)

		expect(ledger.capUsd).toBe(0.3)
		expect((await loadLedger('r1', target))?.capUsd).toBe(0.3)
	})

	it('fills in the default for a bare --stage-cap and leaves an explicit value alone', () => {
		expect(withDefaultStageCap(['--stage', 'r1', '--stage-cap'])).toEqual([
			'--stage',
			'r1',
			'--stage-cap',
			'0.3',
		])
		expect(withDefaultStageCap(['--stage-cap', '--stage', 'r1'])).toEqual([
			'--stage-cap',
			'0.3',
			'--stage',
			'r1',
		])
		expect(withDefaultStageCap(['--stage-cap', '1', '--stage', 'r1'])).toEqual([
			'--stage-cap',
			'1',
			'--stage',
			'r1',
		])
	})

	it('points to --raise-stage-cap when the ledger already exists', async () => {
		const target = await makeDir()
		await createLedger('r1', 0.3, target)

		await expect(createLedger('r1', 0.5, target)).rejects.toThrow(
			/already exists.*--raise-stage-cap <usd> --stage r1/,
		)
	})
})

describe('raiseStageCap', () => {
	it('raises the cap, logs it and keeps the spend', async () => {
		const target = await makeDir()
		await createLedger('r1', 0.3, target)

		const raised = await raiseStageCap('r1', 0.6, { dir: target, now: NOW })

		expect(raised.capUsd).toBe(0.6)
		const saved = await loadLedger('r1', target)
		expect(saved?.capUsd).toBe(0.6)
		expect(saved?.raises).toEqual([{ at: NOW.toISOString(), from: 0.3, to: 0.6 }])
	})

	it('appends to the log on a second raise', async () => {
		const target = await makeDir()
		await createLedger('r1', 0.3, target)
		await raiseStageCap('r1', 0.6, { dir: target, now: NOW })

		await raiseStageCap('r1', 1, { dir: target, now: NOW })

		expect((await loadLedger('r1', target))?.raises).toHaveLength(2)
	})

	it('refuses to lower or to keep the cap and changes nothing', async () => {
		const target = await makeDir()
		await createLedger('r1', 0.5, target)
		const file = join(dir, 'eval-budget-r1.json')
		const before = await readFile(file, 'utf8')

		await expect(raiseStageCap('r1', 0.3, { dir: target })).rejects.toThrow(
			'Стелю можна лише підвищити: зараз $0.50, запитано $0.30',
		)
		await expect(raiseStageCap('r1', 0.5, { dir: target })).rejects.toThrow('лише підвищити')

		expect(await readFile(file, 'utf8')).toBe(before)
	})

	it('refuses when the ledger does not exist', async () => {
		const target = await makeDir()

		await expect(raiseStageCap('nope', 1, { dir: target })).rejects.toThrow(
			'Немає бюджету етапу nope',
		)
	})

	it('reads an old ledger without raises and keeps its runs', async () => {
		const target = await makeDir()
		const old = { capUsd: 1, spentUsd: 0.4, runs: [{ at: 'x', cases: 2, spentUsd: 0.4 }] }
		await writeFile(join(dir, 'eval-budget-old.json'), JSON.stringify(old))

		const raised = await raiseStageCap('old', 2, { dir: target, now: NOW })

		expect(raised.runs).toEqual(old.runs)
		expect(raised.spentUsd).toBe(0.4)
		expect(raised.raises).toEqual([{ at: NOW.toISOString(), from: 1, to: 2 }])
	})

	it('keeps the raise log when a run is added afterwards', async () => {
		const target = await makeDir()
		await createLedger('r1', 0.3, target)
		const raised = await raiseStageCap('r1', 0.6, { dir: target, now: NOW })

		const after = addRun(raised, { at: 'now', cases: 1, spentUsd: 0.1 })

		expect(after.raises).toHaveLength(1)
	})
})
