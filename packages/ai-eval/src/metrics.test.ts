import { FOOD_CATEGORIES } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { type EvalCase, type ExpectedMeasurement, REPO_CASES } from './cases/index.js'
import type { CaseResult } from './eval.types.js'
import {
	countCategoryMatches,
	countMealMatches,
	getErrorPct,
	isDecisionCorrect,
	isEditsCorrect,
	isMeasurementsCorrect,
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
	edits: null,
	measurements: [],
	costUsd: 0.001,
	latencyMs: 1000,
	inputTokens: 3000,
	outputTokens: 300,
	cachedTokens: 0,
	textOnlyAnswers: 0,
	items: [],
	clarifyCalls: [],
	truncated: false,
	validationErrors: [],
	mixedScriptWords: [],
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

	it('accepts any of replyIncludesAny, case-insensitively', () => {
		const asks = evalCase({ decision: 'reply', replyIncludesAny: ['перевір', 'підтверд'] })
		expect(isDecisionCorrect(asks, 'reply', 'Перевір, будь ласка, число')).toBe(true)
		expect(isDecisionCorrect(asks, 'reply', 'Підтверди 87 кг')).toBe(true)
		expect(isDecisionCorrect(asks, 'reply', 'Записав 87')).toBe(false)
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

	it('counts the cases whose every logged item has an allowed source', () => {
		const item = (source: string) => ({
			name: 'Скир',
			mealType: null,
			grams: 150,
			quantity: null,
			kcal: 96,
			protein: 16,
			source,
			memoryRef: null,
			assumption: null,
		})
		const summary = summarize('m', [
			{
				evalCase: evalCase({ decision: 'log', sources: ['LABEL'] }),
				result: result({ items: [item('LABEL')] }),
			},
			{
				evalCase: evalCase({ decision: 'log', sources: ['LABEL'] }),
				result: result({ items: [item('LABEL'), item('ESTIMATE')] }),
			},
			{
				evalCase: evalCase({ decision: 'log', sources: ['LABEL'] }),
				result: result({ items: [] }),
			},
			{ evalCase: evalCase({ decision: 'log' }), result: result({ items: [item('ESTIMATE')] }) },
		])
		expect(summary.sources).toEqual({ correct: 1, total: 3 })
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
		expect([...decisions].sort()).toEqual([
			'clarify',
			'edit',
			'log',
			'log_or_clarify',
			'not_food',
			'reply',
		])
	})
})

describe('isMeasurementsCorrect', () => {
	const today = '2026-10-07'
	const weight = { kind: 'WEIGHT', value: 82.4, date: today, confirmedJump: false } as const

	it('accepts the same set, today and no confirmation by default', () => {
		expect(isMeasurementsCorrect([{ kind: 'WEIGHT', value: 82.4 }], [weight], today)).toBe(true)
	})

	it('rejects another value, kind, day or confirmation', () => {
		const expected: ExpectedMeasurement[] = [{ kind: 'WEIGHT', value: 82.4 }]
		expect(isMeasurementsCorrect(expected, [{ ...weight, value: 82.6 }], today)).toBe(false)
		expect(isMeasurementsCorrect(expected, [{ ...weight, kind: 'WAIST' }], today)).toBe(false)
		expect(isMeasurementsCorrect(expected, [{ ...weight, date: '2026-10-06' }], today)).toBe(false)
		expect(isMeasurementsCorrect(expected, [{ ...weight, confirmedJump: true }], today)).toBe(false)
	})

	it('wants the given day and confirmation', () => {
		const expected: ExpectedMeasurement[] = [
			{ kind: 'WEIGHT', value: 87, date: '2026-10-06', confirmedJump: true },
		]
		const actual = [{ ...weight, value: 87, date: '2026-10-06', confirmedJump: true }]
		expect(isMeasurementsCorrect(expected, actual, today)).toBe(true)
	})

	it('needs exactly the expected set: [] means nothing, extras fail', () => {
		expect(isMeasurementsCorrect([], [], today)).toBe(true)
		expect(isMeasurementsCorrect([], [weight], today)).toBe(false)
		expect(isMeasurementsCorrect([{ kind: 'WEIGHT', value: 82.4 }], [], today)).toBe(false)
	})

	it('counts only the cases that expect measurements', () => {
		const summary = summarize('m', [
			{
				evalCase: evalCase({ decision: 'reply', measurements: [{ kind: 'WEIGHT', value: 82.4 }] }),
				result: result({ decision: 'reply', measurements: [weight] }),
			},
			{
				evalCase: evalCase({ decision: 'reply', measurements: [] }),
				result: result({ decision: 'reply', measurements: [weight] }),
			},
			{ evalCase: evalCase({ decision: 'reply' }), result: result({ decision: 'reply' }) },
		])
		expect(summary.measurements).toEqual({ correct: 1, total: 2 })
	})
})

describe('isEditsCorrect', () => {
	const edits = {
		corrections: [{ ref: 'e3', name: 'Борщ', grams: 600, kcal: 300 }],
		deletions: [],
		restorations: [],
		resolutions: [],
	}

	it('accepts exactly the expected change within its range', () => {
		const expected = { corrected: [{ ref: 'e3', kcal: { min: 290, max: 310 } }] }
		expect(isEditsCorrect(expected, edits)).toBe(true)
	})

	it('rejects a missing, an extra or an out-of-range change', () => {
		expect(isEditsCorrect({ deleted: ['e1'] }, edits)).toBe(false)
		expect(
			isEditsCorrect({ corrected: [{ ref: 'e3', kcal: { min: 400, max: 500 } }] }, edits),
		).toBe(false)
		expect(isEditsCorrect({ corrected: [{ ref: 'e3' }] }, { ...edits, deletions: ['e1'] })).toBe(
			false,
		)
		expect(isEditsCorrect({ deleted: ['e1'] }, null)).toBe(false)
	})

	it('checks the kind of an answer to a question', () => {
		const answered = {
			...edits,
			corrections: [],
			resolutions: [{ ref: 'c1', kind: 'values' as const, optionIndex: null, kcal: 700 }],
		}
		expect(
			isEditsCorrect({ resolved: [{ ref: 'c1', kinds: ['values', 'option'] }] }, answered),
		).toBe(true)
		expect(isEditsCorrect({ resolved: [{ ref: 'c1', kinds: ['close'] }] }, answered)).toBe(false)
	})
})

describe('isDecisionCorrect: honest replies', () => {
	it('fails a reply that claims a change', () => {
		const honest = {
			id: 'x',
			text: 'x',
			reference: 'x',
			expect: { decision: 'reply' as const, replyExcludes: ['змінив'] },
		}
		expect(isDecisionCorrect(honest, 'reply', 'Поки можу змінити лише сьогоднішні записи.')).toBe(
			true,
		)
		expect(isDecisionCorrect(honest, 'reply', 'Змінив борщ на суп.')).toBe(false)
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
