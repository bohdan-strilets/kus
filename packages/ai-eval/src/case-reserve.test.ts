import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
	addToHistory,
	COLD_START_RESERVE_USD,
	type CostHistory,
	getCaseReserveFromHistory,
	getHistoricalP95Usd,
	getOwnCaseReserves,
	getPercentile,
	getStartReserveUsd,
	loadCostHistory,
	MIN_CASE_RESERVE_USD,
} from './case-reserve.js'
import type { CaseResult } from './eval.types.js'

const result = (caseId: string, costUsd: number, model = 'm', cachedTokens = 0): CaseResult =>
	({ caseId, model, costUsd, cachedTokens }) as CaseResult

const warm = (caseId: string, costUsd: number, model = 'm'): CaseResult =>
	result(caseId, costUsd, model, 21000)

const historyOf = (...results: CaseResult[]): CostHistory => {
	const history: CostHistory = new Map()
	addToHistory(history, results)
	return history
}

describe('getPercentile', () => {
	it('uses the nearest rank', () => {
		const values = Array.from({ length: 20 }, (_, i) => i + 1)
		expect(getPercentile(values, 0.95)).toBe(19)
		expect(getPercentile([5, 1, 3], 0.95)).toBe(5)
		expect(getPercentile([], 0.95)).toBe(0)
	})
})

describe('addToHistory', () => {
	it('ignores results without a cost', () => {
		const history = historyOf(result('a', 0), result('b', 0.01))
		expect(history.get('m')?.has('a')).toBe(false)
		expect(history.get('m')?.get('b')).toEqual([{ costUsd: 0.01, isWarm: false }])
	})
})

describe('getCaseReserveFromHistory', () => {
	const upperBoundUsd = 0.158
	const reserve = (history: CostHistory, caseIds: string[], model = 'm') =>
		getCaseReserveFromHistory({ history, model, caseIds, upperBoundUsd })

	it('is p95 of the run cases history × 2', () => {
		const history = historyOf(result('a', 0.02), result('a', 0.03), result('b', 0.5))
		expect(reserve(history, ['a'])).toBeCloseTo(0.06)
	})

	it('falls back to the p95 of the whole model history for cases without their own', () => {
		const history = historyOf(result('x', 0.03), result('y', 0.04))
		expect(reserve(history, ['new'])).toBeCloseTo(0.08)
	})

	it('falls back to the upper bound without any history of the model', () => {
		const history = historyOf(result('x', 0.03, 'other'))
		expect(reserve(history, ['x'])).toBe(upperBoundUsd)
		expect(reserve(new Map(), ['x'])).toBe(upperBoundUsd)
	})

	it('never goes below the minimum', () => {
		expect(reserve(historyOf(result('a', 0.005)), ['a'])).toBe(MIN_CASE_RESERVE_USD)
	})
})

describe('warm history', () => {
	const reserve = (history: CostHistory, caseIds: string[]) =>
		getCaseReserveFromHistory({ history, model: 'm', caseIds, upperBoundUsd: 0.158 })

	it('ignores cold runs when the case has warm ones', () => {
		const history = historyOf(
			result('a', 0.06),
			result('a', 0.06),
			warm('a', 0.008),
			warm('a', 0.01),
		)
		expect(reserve(history, ['a'])).toBeCloseTo(0.02)
	})

	it('takes warm samples of other cases before the cold ones of its own', () => {
		const history = historyOf(result('a', 0.06), warm('b', 0.012))
		expect(reserve(history, ['a'])).toBeCloseTo(0.024)
	})

	it('keeps the cold history when nothing ever ran warm', () => {
		expect(reserve(historyOf(result('a', 0.06)), ['a'])).toBeCloseTo(0.12)
	})
})

describe('getOwnCaseReserves', () => {
	it('gives each case its own reserve, so expensive cases do not raise the cheap ones', () => {
		const history = historyOf(warm('cheap', 0.006), warm('day', 0.045), warm('day', 0.05))
		const reserves = getOwnCaseReserves({
			history,
			model: 'm',
			caseIds: ['cheap', 'day', 'new'],
			upperBoundUsd: 0.158,
		})
		expect(reserves.get('cheap')).toBe(MIN_CASE_RESERVE_USD)
		expect(reserves.get('day')).toBeCloseTo(0.1)
		expect(reserves.has('new')).toBe(false)
	})
})

describe('getHistoricalP95Usd', () => {
	it('is null for an unknown model', () => {
		expect(getHistoricalP95Usd(historyOf(result('a', 0.01)), 'zzz', ['a'])).toBeNull()
	})
})

describe('getStartReserveUsd', () => {
	it('reserves the cold prefix write for the first case only', () => {
		expect(getStartReserveUsd(0.02, true)).toBe(COLD_START_RESERVE_USD)
		expect(getStartReserveUsd(0.02, false)).toBe(0.02)
		expect(getStartReserveUsd(0.2, true)).toBe(0.2)
	})
})

describe('loadCostHistory', () => {
	it('reads .json and .jsonl, skipping zero costs', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'reserve-'))
		await writeFile(
			join(dir, 'a.json'),
			JSON.stringify([{ model: 'm', results: [result('a', 0.01), result('b', 0)] }]),
		)
		await writeFile(join(dir, 'b.jsonl'), `${JSON.stringify(result('a', 0.02))}\n`)
		const history = await loadCostHistory(pathToFileURL(`${dir}/`))
		expect(history.get('m')?.get('a')).toEqual([
			{ costUsd: 0.01, isWarm: false },
			{ costUsd: 0.02, isWarm: false },
		])
		expect(history.get('m')?.has('b')).toBe(false)
	})

	it('is empty when the directory does not exist', async () => {
		const history = await loadCostHistory(pathToFileURL(join(tmpdir(), 'no-such-reserve-dir/')))
		expect(history.size).toBe(0)
	})
})
