import { describe, expect, it } from 'vitest'

import type { ExpectedMemory } from './cases/case.types.js'
import type { EvalCase } from './cases/index.js'
import { EMPTY_CALL_FACTS } from './call-facts.js'
import { NO_MEMORY_CALLS } from './cases/case-builders.js'
import type { CallFacts, CaseResult, LoggedItem } from './eval.types.js'
import {
	areMemoryItemsCorrect,
	areMemoryRefsRight,
	hasMemoryExpectations,
	isCaseMemoryCorrect,
	isFindFoodRight,
	isGetWorkoutsRight,
	isMemoryCorrect,
} from './memory-metrics.js'

const food = (overrides: Partial<CallFacts['savedFoods'][number]> = {}) => ({
	name: 'Кабаноси Tarczyński',
	aliases: [],
	per100g: { kcal: 280, protein: 24, fat: 20, carbs: 2, fiber: null },
	pieceGrams: 15,
	defaultGrams: null,
	category: 'meat' as const,
	fromItemIndex: null,
	updateRef: null,
	...overrides,
})

const fact = (overrides: Partial<CallFacts['facts'][number]> = {}) => ({
	text: 'Не їсть рибу',
	category: 'FOOD' as const,
	explicit: true,
	...overrides,
})

const calls = (overrides: Partial<CallFacts>): CallFacts => ({ ...EMPTY_CALL_FACTS, ...overrides })

describe('isMemoryCorrect: foods', () => {
	it('matches the name stem, per100g and piece grams', () => {
		const expected: ExpectedMemory = {
			foods: [{ nameIncludes: 'кабаноси', hasPer100g: true, pieceGrams: 15, fromItemIndex: null }],
		}
		expect(isMemoryCorrect(expected, calls({ savedFoods: [food()] }))).toBe(true)
	})

	it('fails when a field differs or the food is not saved', () => {
		const expected: ExpectedMemory = { foods: [{ nameIncludes: 'кабаноси', pieceGrams: 20 }] }
		expect(isMemoryCorrect(expected, calls({ savedFoods: [food()] }))).toBe(false)
		expect(isMemoryCorrect(expected, EMPTY_CALL_FACTS)).toBe(false)
	})

	it('checks fromItemIndex and updateRef', () => {
		expect(
			isMemoryCorrect(
				{ foods: [{ fromItemIndex: 0, hasPer100g: false }] },
				calls({ savedFoods: [food({ per100g: null, fromItemIndex: 0 })] }),
			),
		).toBe(true)
		expect(
			isMemoryCorrect(
				{ foods: [{ updateRef: 'm1' }] },
				calls({ savedFoods: [food({ updateRef: null })] }),
			),
		).toBe(false)
	})

	it('counts exactly: an extra save_food fails, [] means none', () => {
		const expected: ExpectedMemory = { foods: [{ nameIncludes: 'кабаноси' }] }
		expect(isMemoryCorrect(expected, calls({ savedFoods: [food(), food()] }))).toBe(false)
		expect(isMemoryCorrect({ foods: [] }, calls({ savedFoods: [food()] }))).toBe(false)
		expect(isMemoryCorrect({ foods: [] }, EMPTY_CALL_FACTS)).toBe(true)
	})

	it('does not judge a part that is not set', () => {
		expect(isMemoryCorrect({ forgets: [] }, calls({ savedFoods: [food()] }))).toBe(true)
	})
})

describe('isMemoryCorrect: facts', () => {
	it('checks explicit, category and the text', () => {
		const expected: ExpectedMemory = {
			fact: { explicit: true, category: 'FOOD', textIncludesAny: ['риб'] },
		}
		expect(isMemoryCorrect(expected, calls({ facts: [fact()] }))).toBe(true)
		expect(isMemoryCorrect(expected, calls({ facts: [fact({ explicit: false })] }))).toBe(false)
		expect(isMemoryCorrect(expected, calls({ facts: [fact({ category: 'OTHER' })] }))).toBe(false)
		expect(isMemoryCorrect(expected, calls({ facts: [fact({ text: 'Любить сир' })] }))).toBe(false)
	})

	it('null means no save_fact; two facts never match one expectation', () => {
		expect(isMemoryCorrect({ fact: null }, EMPTY_CALL_FACTS)).toBe(true)
		expect(isMemoryCorrect({ fact: null }, calls({ facts: [fact()] }))).toBe(false)
		expect(isMemoryCorrect({ fact: {} }, calls({ facts: [fact(), fact()] }))).toBe(false)
		expect(isMemoryCorrect({ fact: {} }, EMPTY_CALL_FACTS)).toBe(false)
	})

	it('an optional fact may be missing, but a saved one must match and keep the banned words out', () => {
		const expected: ExpectedMemory = {
			fact: { isOptional: true, explicit: false, textExcludes: ['алерг'] },
		}
		expect(isMemoryCorrect(expected, EMPTY_CALL_FACTS)).toBe(true)
		expect(isMemoryCorrect(expected, calls({ facts: [fact({ explicit: false })] }))).toBe(true)
		expect(isMemoryCorrect(expected, calls({ facts: [fact({ explicit: true })] }))).toBe(false)
		expect(
			isMemoryCorrect(
				expected,
				calls({ facts: [fact({ explicit: false, text: 'Алергія на горіхи' })] }),
			),
		).toBe(false)
	})
})

describe('isMemoryCorrect: forgets and no memory at all', () => {
	it('forgets are the same set of refs', () => {
		expect(isMemoryCorrect({ forgets: ['f1'] }, calls({ forgets: [{ ref: 'f1' }] }))).toBe(true)
		expect(isMemoryCorrect({ forgets: ['f1'] }, calls({ forgets: [{ ref: 'f2' }] }))).toBe(false)
		expect(isMemoryCorrect({ forgets: ['f1'] }, EMPTY_CALL_FACTS)).toBe(false)
	})

	it('NO_MEMORY_CALLS fails on any memory call', () => {
		expect(isMemoryCorrect(NO_MEMORY_CALLS, EMPTY_CALL_FACTS)).toBe(true)
		expect(isMemoryCorrect(NO_MEMORY_CALLS, calls({ savedFoods: [food()] }))).toBe(false)
		expect(isMemoryCorrect(NO_MEMORY_CALLS, calls({ facts: [fact()] }))).toBe(false)
		expect(isMemoryCorrect(NO_MEMORY_CALLS, calls({ forgets: [{ ref: 'f1' }] }))).toBe(false)
		expect(
			isMemoryCorrect(NO_MEMORY_CALLS, calls({ foodRemovals: [{ ref: 'm1', confirmed: false }] })),
		).toBe(false)
		expect(isMemoryCorrect(NO_MEMORY_CALLS, calls({ foodRestores: [{ ref: 'g1' }] }))).toBe(false)
	})

	it('a result saved before the food tools counts as no removals', () => {
		const { foodRemovals: _removals, foodRestores: _restores, ...old } = EMPTY_CALL_FACTS
		expect(isMemoryCorrect(NO_MEMORY_CALLS, old)).toBe(true)
	})
})

describe('isMemoryCorrect: forget_food and restore_food', () => {
	it('judges the ref together with whether the user had agreed', () => {
		const expected: ExpectedMemory = { foodRemovals: [{ ref: 'm1', confirmed: true }] }
		expect(
			isMemoryCorrect(expected, calls({ foodRemovals: [{ ref: 'm1', confirmed: true }] })),
		).toBe(true)
		expect(
			isMemoryCorrect(expected, calls({ foodRemovals: [{ ref: 'm1', confirmed: false }] })),
		).toBe(false)
		expect(isMemoryCorrect(expected, EMPTY_CALL_FACTS)).toBe(false)
	})

	it('noConfirmedRemoval allows a repeated question but not a confirmed removal', () => {
		const expected: ExpectedMemory = { noConfirmedRemoval: true }
		expect(isMemoryCorrect(expected, EMPTY_CALL_FACTS)).toBe(true)
		expect(
			isMemoryCorrect(expected, calls({ foodRemovals: [{ ref: 'm1', confirmed: false }] })),
		).toBe(true)
		expect(
			isMemoryCorrect(expected, calls({ foodRemovals: [{ ref: 'm1', confirmed: true }] })),
		).toBe(false)
	})

	it('restores are the same set of g-refs', () => {
		expect(
			isMemoryCorrect({ foodRestores: ['g1'] }, calls({ foodRestores: [{ ref: 'g1' }] })),
		).toBe(true)
		expect(
			isMemoryCorrect({ foodRestores: ['g1'] }, calls({ foodRestores: [{ ref: 'g2' }] })),
		).toBe(false)
	})
})

const item = (overrides: Partial<LoggedItem> = {}): LoggedItem => ({
	name: 'Кабаноси',
	mealType: null,
	grams: 50,
	quantity: null,
	kcal: 140,
	protein: 12,
	source: 'MEMORY',
	memoryRef: 'm1',
	copyRef: null,
	assumption: null,
	...overrides,
})

describe('areMemoryItemsCorrect', () => {
	it('wants source MEMORY, the ref and the grams', () => {
		expect(areMemoryItemsCorrect([{ ref: 'm1', grams: 50 }], [item()])).toBe(true)
		expect(areMemoryItemsCorrect([{ ref: 'm1', grams: 50 }], [item({ grams: 100 })])).toBe(false)
		expect(areMemoryItemsCorrect([{ ref: 'm1', grams: 50 }], [item({ source: 'ESTIMATE' })])).toBe(
			false,
		)
		expect(areMemoryItemsCorrect([{ ref: 'm1', grams: 50 }], [item({ memoryRef: 'm2' })])).toBe(
			false,
		)
	})

	it('nothing logged is a miss', () => {
		expect(areMemoryItemsCorrect([{ ref: 'm1', grams: 15 }], [])).toBe(false)
	})
})

describe('find_food and memory-ref expectations', () => {
	const item = (memoryRef: string | null): LoggedItem => ({
		name: 'Батончик',
		mealType: null,
		grams: 45,
		quantity: null,
		kcal: 170,
		protein: 15,
		source: 'MEMORY',
		memoryRef,
		copyRef: null,
		assumption: null,
	})
	const withReads = (findFoodCalls: number) =>
		({ reads: { steps: findFoodCalls > 0 ? 1 : 0, findFoodCalls } }) as CaseResult

	it('tells a lookup that happened from one that did not, also in results saved without reads', () => {
		expect(isFindFoodRight(true, withReads(1))).toBe(true)
		expect(isFindFoodRight(true, withReads(0))).toBe(false)
		expect(isFindFoodRight(false, withReads(0))).toBe(true)
		expect(isFindFoodRight(false, {} as CaseResult)).toBe(true)
	})

	it('compares the refs of the logged items as a set, each ref once', () => {
		expect(areMemoryRefsRight(['m1'], [item('m1'), item('m1')])).toBe(true)
		expect(areMemoryRefsRight(['m11'], [item('m1')])).toBe(false)
		expect(areMemoryRefsRight([], [item(null)])).toBe(true)
		expect(areMemoryRefsRight([], [item('m1')])).toBe(false)
	})

	it('are memory expectations of their own, judged without any save_food expectation', () => {
		const evalCase = { expect: { decision: 'log', findFoodCalled: true } } as EvalCase
		expect(hasMemoryExpectations(evalCase)).toBe(true)
		const result = { ...withReads(1), calls: EMPTY_CALL_FACTS, items: [] } as unknown as CaseResult
		expect(isCaseMemoryCorrect(evalCase, result)).toBe(true)
		expect(
			isCaseMemoryCorrect(evalCase, { ...result, reads: { steps: 0, findFoodCalls: 0 } }),
		).toBe(false)
	})
})

describe('get_workouts expectations', () => {
	const withCalls = (
		...calls: { days: number; endDate: string | null; exercise: string | null }[]
	) => ({ reads: { steps: 1, findFoodCalls: 0, getWorkouts: calls } }) as CaseResult
	const call = (days: number, endDate: string | null = null, exercise: string | null = null) => ({
		days,
		endDate,
		exercise,
	})

	it('tells a call that happened from one that did not, also in results without reads', () => {
		expect(isGetWorkoutsRight({ called: true }, withCalls(call(30)))).toBe(true)
		expect(isGetWorkoutsRight({ called: true }, withCalls())).toBe(false)
		expect(isGetWorkoutsRight({ called: false }, {} as CaseResult)).toBe(true)
		expect(isGetWorkoutsRight({ called: false }, withCalls(call(7)))).toBe(false)
	})

	it('judges the period, its end and the exercise of every call', () => {
		const expected = {
			called: true,
			days: { min: 10, max: 10 },
			endDateNull: true,
			exerciseStem: 'жим',
		}

		expect(isGetWorkoutsRight(expected, withCalls(call(10, null, 'Жим лежачи')))).toBe(true)
		expect(isGetWorkoutsRight(expected, withCalls(call(30, null, 'жим')))).toBe(false)
		expect(isGetWorkoutsRight(expected, withCalls(call(10, '2026-11-08', 'жим')))).toBe(false)
		expect(isGetWorkoutsRight(expected, withCalls(call(10, null, null)))).toBe(false)
	})

	it('is a memory expectation of its own', () => {
		const evalCase = { expect: { decision: 'reply', getWorkouts: { called: true } } } as EvalCase

		expect(hasMemoryExpectations(evalCase)).toBe(true)
		expect(
			isCaseMemoryCorrect(evalCase, {
				...withCalls(call(30)),
				calls: EMPTY_CALL_FACTS,
				items: [],
			}),
		).toBe(true)
	})
})
