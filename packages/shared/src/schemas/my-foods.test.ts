import { describe, expect, it } from 'vitest'

import {
	myFoodPer100gSchema,
	myFoodsQuerySchema,
	REMEMBER_ENTRIES_MAX,
	rememberEntriesRequestSchema,
	updateMyFoodRequestSchema,
} from './my-foods.js'

const KABANOSY = { kcal: 280, protein: 24, fat: 20, carbs: 2, fiber: null }
const ID = '0190f3a0-0000-7000-8000-000000000001'

const getMessages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
	result.error?.issues.map((issue) => issue.message) ?? []

describe('myFoodPer100gSchema', () => {
	it('accepts label values without checking kcal against the macros', () => {
		expect(myFoodPer100gSchema.safeParse({ ...KABANOSY, kcal: 428 }).success).toBe(true)
	})

	it('fills a missing fiber with null', () => {
		const { fiber: _fiber, ...withoutFiber } = KABANOSY
		const result = myFoodPer100gSchema.safeParse(withoutFiber)

		expect(result.success && result.data.fiber).toBeNull()
	})

	it('rejects more kcal than fat could carry', () => {
		expect(getMessages(myFoodPer100gSchema.safeParse({ ...KABANOSY, kcal: 951 }))).toContain(
			'KCAL_DENSITY_TOO_HIGH',
		)
	})

	it('rejects macros that weigh more than 100 g', () => {
		const result = myFoodPer100gSchema.safeParse({ ...KABANOSY, protein: 60, carbs: 30, fiber: 15 })

		expect(getMessages(result)).toContain('MACROS_OVER_100G')
	})

	it('rejects a negative value', () => {
		expect(myFoodPer100gSchema.safeParse({ ...KABANOSY, fat: -1 }).success).toBe(false)
	})
})

describe('updateMyFoodRequestSchema', () => {
	it('accepts one field and a null that clears the piece weight', () => {
		expect(updateMyFoodRequestSchema.safeParse({ pieceGrams: null }).success).toBe(true)
		expect(updateMyFoodRequestSchema.safeParse({ name: ' Кабаноси ' }).success).toBe(true)
	})

	it('rejects an empty body', () => {
		expect(getMessages(updateMyFoodRequestSchema.safeParse({}))).toContain('NOTHING_TO_CHANGE')
	})

	it('rejects a usual portion outside the entry limits', () => {
		expect(updateMyFoodRequestSchema.safeParse({ defaultGrams: 0 }).success).toBe(false)
		expect(updateMyFoodRequestSchema.safeParse({ defaultGrams: 5001 }).success).toBe(false)
	})
})

describe('rememberEntriesRequestSchema', () => {
	it('takes 1 to the maximum of distinct entry ids', () => {
		expect(rememberEntriesRequestSchema.safeParse({ entryIds: [ID] }).success).toBe(true)
		expect(rememberEntriesRequestSchema.safeParse({ entryIds: [] }).success).toBe(false)
		const toId = (index: number): string =>
			`0190f3a0-0000-7000-8000-${index.toString(16).padStart(12, '0')}`
		const atMost = Array.from({ length: REMEMBER_ENTRIES_MAX }, (_, index) => toId(index))

		expect(rememberEntriesRequestSchema.safeParse({ entryIds: atMost }).success).toBe(true)
		expect(
			rememberEntriesRequestSchema.safeParse({ entryIds: [...atMost, toId(REMEMBER_ENTRIES_MAX)] })
				.success,
		).toBe(false)
	})

	it('rejects the same entry twice', () => {
		const result = rememberEntriesRequestSchema.safeParse({ entryIds: [ID, ID] })

		expect(getMessages(result)).toContain('DUPLICATE_IDS')
	})
})

describe('myFoodsQuerySchema', () => {
	it('defaults to the first page of the whole list', () => {
		expect(myFoodsQuerySchema.parse({})).toEqual({ page: 1, limit: 500 })
	})

	it('reads numbers from the query string and trims the search', () => {
		expect(myFoodsQuerySchema.parse({ q: ' кабан ', page: '2', limit: '20' })).toEqual({
			q: 'кабан',
			page: 2,
			limit: 20,
		})
	})
})

describe('updateMyFoodRequestSchema name', () => {
	it('keeps the name on one line with single spaces', () => {
		const result = updateMyFoodRequestSchema.safeParse({ name: '  Кабаноси\n\nTarczyński  ' })

		expect(result.success && result.data.name).toBe('Кабаноси Tarczyński')
	})

	it('rejects a name of only spaces and line breaks', () => {
		expect(updateMyFoodRequestSchema.safeParse({ name: ' \n ' }).success).toBe(false)
	})
})
