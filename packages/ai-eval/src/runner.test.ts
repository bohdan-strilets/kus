import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EvalCase } from './cases/index.js'
import type { CaseResult } from './eval.types.js'
import { runCase } from './run-case.js'
import { canStartCase, type RunBudget, runModel } from './runner.js'

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

	it('reports cases that cost more than their reserve', async () => {
		runCaseMock.mockResolvedValueOnce(costing(0.05)).mockResolvedValueOnce(costing(0.15))
		const budget = { spentUsd: 0, maxUsd: 1, reservedUsd: 0 }

		const result = await run(makeCases(2), budget, 0.1)

		expect(result.overReserve).toEqual(['case-1'])
	})
})
