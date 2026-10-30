import { describe, expect, it } from 'vitest'

import type { ExpectedMemory } from './cases/case.types.js'
import { EMPTY_CALL_FACTS } from './call-facts.js'
import { NO_MEMORY_CALLS } from './cases/case-builders.js'
import type { CallFacts, LoggedItem } from './eval.types.js'
import { areMemoryItemsCorrect, isMemoryCorrect } from './memory-metrics.js'

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
