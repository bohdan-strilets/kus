import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EvalCase } from './cases/index.js'
import type { CaseResult } from './eval.types.js'
import { runCase } from './run-case.js'
import { createProgressReporter } from './progress.js'
import { canStartCase, hasReachedSoftStop, type RunBudget, runModel } from './runner.js'

vi.mock('./run-case.js', () => ({ runCase: vi.fn() }))

const runCaseMock = vi.mocked(runCase)

const makeCases = (count: number): EvalCase[] =>
	Array.from(
		{ length: count },
		(_, index) => ({ id: `case-${index}`, text: 'x', expect: { decision: 'log' } }) as EvalCase,
	)

const costing = (costUsd: number): CaseResult => ({ costUsd }) as CaseResult

const run = (cases: EvalCase[], budget: RunBudget, caseReserveUsd: number, concurrency = 1) =>
	runModel(cases, {
		apiKey: 'key',
		model: 'm',
		reasoning: 'low',
		concurrency,
		budget,
		caseReserveUsd,
	})

beforeEach(() => {
	runCaseMock.mockReset()
})

describe('canStartCase', () => {
	it('allows a case that fits exactly', () => {
		expect(canStartCase({ spentUsd: 0.6, reservedUsd: 0.2, maxUsd: 1 }, 0.2)).toBe(true)
	})

	it('counts the reserves of cases in flight', () => {
		expect(canStartCase({ spentUsd: 0.6, reservedUsd: 0.3, maxUsd: 1 }, 0.2)).toBe(false)
	})
})

describe('runModel with a hard budget', () => {
	it('stops before the spend could pass --max-cost', async () => {
		runCaseMock.mockResolvedValue(costing(0.3))
		const budget = { spentUsd: 0, maxUsd: 1, reservedUsd: 0 }

		const result = await run(makeCases(5), budget, 0.3)

		// 3 × 0.3 = 0.9; a 4th reserve would need 1.2
		expect(result.pairs).toHaveLength(3)
		expect(result.skipped).toBe(2)
		expect(budget.spentUsd).toBeCloseTo(0.9)
		expect(budget.reservedUsd).toBe(0)
	})

	it('runs nothing when one reserve is above the limit', async () => {
		const budget = { spentUsd: 0, maxUsd: 0.1, reservedUsd: 0 }

		const result = await run(makeCases(3), budget, 0.2)

		expect(runCaseMock).not.toHaveBeenCalled()
		expect(result.skipped).toBe(3)
	})

	it('starts 2 cases under 0.1 with a history-based reserve (cold first case, then cached)', async () => {
		runCaseMock.mockResolvedValue(costing(0.008))
		const budget = { spentUsd: 0, maxUsd: 0.1, reservedUsd: 0 }

		const result = await run(makeCases(2), budget, 0.02)

		expect(runCaseMock).toHaveBeenCalledTimes(2)
		expect(result.skipped).toBe(0)
	})

	it('reserves the cold start for the first case only', async () => {
		const budget = { spentUsd: 0, maxUsd: 0.06, reservedUsd: 0 }

		const result = await run(makeCases(2), budget, 0.02)

		expect(runCaseMock).not.toHaveBeenCalled()
		expect(result.skipped).toBe(2)
	})

	it('never lets parallel cases reserve more than the limit', async () => {
		let running = 0
		let peak = 0
		runCaseMock.mockImplementation(async () => {
			running += 1
			peak = Math.max(peak, running)
			await new Promise((resolve) => setTimeout(resolve, 5))
			running -= 1
			return costing(0.05)
		})
		const budget = { spentUsd: 0, maxUsd: 0.5, reservedUsd: 0 }

		const result = await run(makeCases(10), budget, 0.2, 4)

		// only 2 reserves of 0.2 fit at once; cheap results free room for the rest
		expect(peak).toBe(2)
		expect(budget.spentUsd).toBeLessThanOrEqual(budget.maxUsd)
		expect(result.pairs.length + result.skipped).toBe(10)
		expect(result.pairs.length).toBeGreaterThan(2)
	})

	it('fits a 46-case smoke under 0.55 with a warm reserve, and never passes the limit', async () => {
		let calls = 0
		runCaseMock.mockImplementation(async () => {
			const index = (calls += 1)
			await new Promise((resolve) => setTimeout(resolve, 1))
			// the first 4 start together with no cache; the rest read it
			return costing(index <= 4 ? 0.06 : 0.0065)
		})
		const budget = { spentUsd: 0, maxUsd: 0.55, reservedUsd: 0 }

		const result = await run(makeCases(46), budget, 0.02, 4)

		expect(result.skipped).toBe(0)
		expect(result.pairs).toHaveLength(46)
		expect(budget.spentUsd).toBeCloseTo(4 * 0.06 + 42 * 0.0065)
		expect(budget.spentUsd).toBeLessThanOrEqual(budget.maxUsd)
	})

	it('reserves per case: an expensive one does not block the cheap ones', async () => {
		runCaseMock.mockResolvedValue(costing(0.005))
		const budget = { spentUsd: 0, maxUsd: 0.1, reservedUsd: 0 }
		const cases = makeCases(3)

		const result = await runModel(cases, {
			apiKey: 'key',
			model: 'm',
			reasoning: 'low',
			concurrency: 1,
			budget,
			caseReserveUsd: 0.02,
			caseReserves: new Map([['case-2', 0.5]]),
		})

		expect(result.pairs.map((pair) => pair.evalCase.id)).toEqual(['case-0', 'case-1'])
		expect(result.skipped).toBe(1)
	})

	it('reports cases that cost more than their reserve', async () => {
		runCaseMock.mockResolvedValueOnce(costing(0.05)).mockResolvedValueOnce(costing(0.15))
		const budget = { spentUsd: 0, maxUsd: 1, reservedUsd: 0 }

		const result = await run(makeCases(2), budget, 0.1)

		expect(result.overReserve).toEqual(['case-1'])
	})

	it('compares the first case with the cold-start reserve it actually got', async () => {
		runCaseMock.mockResolvedValueOnce(costing(0.06)).mockResolvedValueOnce(costing(0.06))
		const budget = { spentUsd: 0, maxUsd: 1, reservedUsd: 0 }

		const result = await run(makeCases(2), budget, 0.02)

		// 0.06 is under the cold reserve (0.07) of the first case, but over the 0.02 of the second
		expect(result.overReserve).toEqual(['case-1'])
	})
})

describe('runModel with a stage soft stop', () => {
	it('starts no new case once spent + reserved reach the threshold', async () => {
		runCaseMock.mockResolvedValue(costing(0.3))
		const budget: RunBudget = { spentUsd: 0, maxUsd: 10, reservedUsd: 0, softStopUsd: 0.8 }

		const result = await run(makeCases(6), budget, 0.3)

		// 0.3, 0.6 run; at 0.9 >= 0.8 the rest is left
		expect(result.pairs).toHaveLength(3)
		expect(result.skipped).toBe(3)
		expect(result.isSoftStopped).toBe(true)
		expect(budget.isSoftStopped).toBe(true)
	})

	it('lets in-flight cases finish', async () => {
		runCaseMock.mockImplementation(async () => {
			await new Promise((resolve) => setTimeout(resolve, 5))
			return costing(0.2)
		})
		const budget: RunBudget = { spentUsd: 0, maxUsd: 10, reservedUsd: 0, softStopUsd: 0.5 }

		const result = await run(makeCases(10), budget, 0.2, 4)

		expect(result.isSoftStopped).toBe(true)
		expect(result.pairs.length + result.skipped).toBe(10)
		expect(budget.reservedUsd).toBeCloseTo(0)
		expect(runCaseMock).toHaveBeenCalledTimes(result.pairs.length)
	})

	it('does nothing special without a threshold', async () => {
		runCaseMock.mockResolvedValue(costing(0.1))
		const budget: RunBudget = { spentUsd: 0, maxUsd: 10, reservedUsd: 0 }

		const result = await run(makeCases(3), budget, 0.1)

		expect(result.isSoftStopped).toBe(false)
		expect(result.skipped).toBe(0)
	})

	it('still respects the hard cap when the soft stop is off', async () => {
		runCaseMock.mockResolvedValue(costing(0.3))
		const budget: RunBudget = { spentUsd: 0, maxUsd: 1, reservedUsd: 0 }

		const result = await run(makeCases(5), budget, 0.3)

		expect(result.pairs).toHaveLength(3)
		expect(result.isSoftStopped).toBe(false)
		expect(result.skipped).toBe(2)
	})
})

describe('hasReachedSoftStop', () => {
	it('counts in-flight reserves and is sticky once set', () => {
		const budget: RunBudget = { spentUsd: 0.5, maxUsd: 9, reservedUsd: 0.3, softStopUsd: 0.8 }
		expect(hasReachedSoftStop(budget)).toBe(true)
		expect(hasReachedSoftStop({ ...budget, reservedUsd: 0.2 })).toBe(false)
		expect(hasReachedSoftStop({ ...budget, reservedUsd: 0, isSoftStopped: true })).toBe(true)
	})
})

describe('createProgressReporter', () => {
	it('prints each step once at 25, 50 and 80 % of the cap', () => {
		const lines: string[] = []
		const report = createProgressReporter(2, (text) => lines.push(text))

		report(0.4)
		report(0.5)
		report(1.1)
		report(1.7)
		report(1.9)

		expect(lines).toHaveLength(3)
		expect(lines[0]).toContain('25 %')
		expect(lines[1]).toContain('50 %')
		expect(lines[2]).toContain('80 %')
	})
})

describe('runModel with Ctrl+C', () => {
	it('starts no new case after the interrupt, and awaits the case-done hook of finished ones', async () => {
		const budget: RunBudget = { spentUsd: 0, maxUsd: 10, reservedUsd: 0 }
		runCaseMock.mockImplementation(() => {
			budget.isInterrupted = true
			return Promise.resolve(costing(0.1))
		})
		const done: string[] = []

		const result = await runModel(makeCases(5), {
			apiKey: 'key',
			model: 'm',
			reasoning: 'low',
			concurrency: 1,
			budget,
			caseReserveUsd: 0.1,
			onCaseDone: () =>
				new Promise<void>((resolve) => {
					setTimeout(() => {
						done.push('written')
						resolve()
					}, 5)
				}),
		})

		expect(result.pairs).toHaveLength(1)
		expect(done).toEqual(['written'])
		expect(result.skipped).toBe(4)
		expect(result.isInterrupted).toBe(true)
		expect(budget.spentUsd).toBeCloseTo(0.1)
	})
})
