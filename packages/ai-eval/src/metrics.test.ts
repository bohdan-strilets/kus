import { FOOD_CATEGORIES } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { type EvalCase, REPO_CASES } from './cases/index.js'
import type { CaseResult } from './eval.types.js'
import {
	countCategoryMatches,
	countMealMatches,
	getErrorPct,
	isDecisionCorrect,
	summarize,
} from './metrics.js'

const result = (overrides: Partial<CaseResult>): CaseResult => ({
	caseId: 'c',
	model: 'm',
	decision: 'log',
	wasRetried: false,
	attempts: 1,
	error: null,
	kcal: null,
	protein: null,
	categories: [],
	replyText: null,
	costUsd: 0.001,
	latencyMs: 1000,
	inputTokens: 3000,
	outputTokens: 300,
	cachedTokens: 0,
	textOnlyAnswers: 0,
	items: [],
	clarifyCalls: [],
	truncated: false,
	...overrides,
})

const evalCase = (expect: EvalCase['expect']): EvalCase => ({
	id: 'c',
	text: 't',
	expect,
	reference: 'r',
})

describe('getErrorPct', () => {
	it('measures exact references in percent', () => {
		expect(getErrorPct({ exact: 200 }, 220, 50)).toBeCloseTo(10)
	})

	it('is 0 inside a range and counts to the nearest bound outside', () => {
		expect(getErrorPct({ min: 100, max: 200 }, 150, 50)).toBe(0)
		expect(getErrorPct({ min: 100, max: 200 }, 90, 50)).toBeCloseTo(10)
		expect(getErrorPct({ min: 100, max: 200 }, 240, 50)).toBeCloseTo(20)
	})

	it('uses the floor as the base for tiny references', () => {
		expect(getErrorPct({ exact: 0.5 }, 1.5, 5)).toBeCloseTo(20)
	})
})

describe('isDecisionCorrect', () => {
	it('accepts log or clarify for log_or_clarify', () => {
		const flexible = evalCase({ decision: 'log_or_clarify' })
		expect(isDecisionCorrect(flexible, 'clarify', null)).toBe(true)
		expect(isDecisionCorrect(flexible, 'reply', null)).toBe(false)
	})

	it('treats an unnecessary question as wrong for log', () => {
		expect(isDecisionCorrect(evalCase({ decision: 'log' }), 'clarify', null)).toBe(false)
	})

	it('checks required reply facts', () => {
		const remaining = evalCase({ decision: 'reply', replyIncludes: ['760'] })
		expect(isDecisionCorrect(remaining, 'reply', 'Ще 760 ккал')).toBe(true)
		expect(isDecisionCorrect(remaining, 'reply', 'Ще трохи')).toBe(false)
	})
})

describe('countCategoryMatches', () => {
	it('counts each logged item once', () => {
		expect(countCategoryMatches(['eggs', 'porridge'], ['eggs', 'eggs'])).toBe(1)
		expect(countCategoryMatches(['salad'], ['salad', 'sauce'])).toBe(1)
	})
})

describe('summarize', () => {
	it('splits exact and range errors and skips cases without an answer', () => {
		const summary = summarize('m', [
			{
				evalCase: evalCase({ decision: 'log', kcal: { exact: 100 } }),
				result: result({ kcal: 110 }),
			},
			{
				evalCase: evalCase({ decision: 'log', kcal: { min: 100, max: 200 } }),
				result: result({ kcal: 150 }),
			},
			{
				evalCase: evalCase({ decision: 'log', kcal: { exact: 100 } }),
				result: result({ decision: 'error' }),
			},
		])
		expect(summary.kcal.exact).toEqual({ count: 1, meanPct: 10, medianPct: 10 })
		expect(summary.kcal.range).toEqual({ count: 1, meanPct: 0, medianPct: 0 })
		expect(summary.failed).toBe(1)
		expect(summary.decisions).toMatchObject({ correct: 2, total: 3 })
	})
})

describe('repo cases', () => {
	it('have unique ids', () => {
		const ids = REPO_CASES.map((item) => item.id)
		expect(new Set(ids).size).toBe(ids.length)
	})

	it('have a kcal reference in at least 40 cases', () => {
		expect(REPO_CASES.filter((item) => item.expect.kcal).length).toBeGreaterThanOrEqual(40)
	})

	it('cover every food category at least once', () => {
		const covered = new Set(REPO_CASES.flatMap((item) => item.expect.categories ?? []))
		expect(FOOD_CATEGORIES.filter((category) => !covered.has(category))).toEqual([])
	})

	it('cover every decision', () => {
		const decisions = new Set(REPO_CASES.map((item) => item.expect.decision))
		expect([...decisions].sort()).toEqual(['clarify', 'log', 'log_or_clarify', 'not_food', 'reply'])
	})
})

describe('countMealMatches', () => {
	const day = evalCase({
		decision: 'log',
		itemMeals: [
			{ stem: 'борщ', mealType: 'LUNCH' },
			{ stem: 'гречк', mealType: 'DINNER' },
		],
	})
	const logged = (name: string, mealType: string | null) => ({
		name,
		mealType,
		grams: 300,
		quantity: null,
		kcal: 150,
		protein: 5,
		source: 'ESTIMATE',
		memoryRef: null,
		assumption: null,
	})

	it('counts an item only in its expected meal', () => {
		const items = [logged('Борщ', 'LUNCH'), logged('Гречка варена', 'LUNCH')]
		expect(countMealMatches(day, result({ items }))).toBe(1)
	})

	it('does not count a missing item or one left to the clock', () => {
		expect(countMealMatches(day, result({ items: [logged('Борщ', null)] }))).toBe(0)
	})
})
