import { describe, expect, it } from 'vitest'

import type { FoodEntry } from '../../generated/prisma/client'
import { compareByName, isFoodMatchingQuery, toNewMyFood } from './my-foods.utils'

const createEntry = (overrides: Partial<FoodEntry> = {}): FoodEntry =>
	({
		name: '  Йогурт  Грецький ',
		grams: 150,
		quantity: null,
		kcal: 120,
		proteinG: 15,
		fatG: 3,
		carbsG: 6,
		fiberG: null,
		category: 'yogurt',
		source: 'ESTIMATE',
		...overrides,
	}) as FoodEntry

describe('toNewMyFood', () => {
	it('scales the portion back to 100 g and keeps it as the usual one', () => {
		expect(toNewMyFood(createEntry())).toMatchObject({
			name: '  Йогурт  Грецький ',
			nameNormalized: 'йогурт грецький',
			kcalPer100g: 80,
			proteinPer100g: 10,
			fatPer100g: 2,
			carbsPer100g: 4,
			fiberPer100g: null,
			pieceGrams: null,
			defaultGrams: 150,
			source: 'AI',
		})
	})

	it('derives the piece weight from the quantity and scales fiber', () => {
		const food = toNewMyFood(createEntry({ grams: 90, quantity: 3, fiberG: 4.5 }))

		expect(food.pieceGrams).toBe(30)
		expect(food.fiberPer100g).toBe(5)
	})

	it('ignores a zero quantity', () => {
		expect(toNewMyFood(createEntry({ quantity: 0 })).pieceGrams).toBeNull()
	})

	it('maps the entry source to the food source', () => {
		expect(toNewMyFood(createEntry({ source: 'LABEL' })).source).toBe('LABEL')
		expect(toNewMyFood(createEntry({ source: 'MANUAL' })).source).toBe('MANUAL')
		expect(toNewMyFood(createEntry({ source: 'MEMORY' })).source).toBe('AI')
		expect(toNewMyFood(createEntry({ source: 'REFERENCE' })).source).toBe('AI')
	})
})

describe('isFoodMatchingQuery', () => {
	const food = { nameNormalized: 'гречка варена', aliases: ['каша'] }

	it('matches a part of the name or of an alias, ignoring case and spaces around', () => {
		expect(isFoodMatchingQuery(food, ' ГРЕЧ ')).toBe(true)
		expect(isFoodMatchingQuery(food, 'аш')).toBe(true)
	})

	it('does not match anything else; an empty query matches all', () => {
		expect(isFoodMatchingQuery(food, 'рис')).toBe(false)
		expect(isFoodMatchingQuery(food, '  ')).toBe(true)
	})
})

describe('compareByName', () => {
	it('sorts Ukrainian names alphabetically', () => {
		const names = ['яблуко', 'банан', 'їжак', 'авокадо'].map((nameNormalized) => ({
			nameNormalized,
		}))

		expect(names.sort(compareByName).map((item) => item.nameNormalized)).toEqual([
			'авокадо',
			'банан',
			'їжак',
			'яблуко',
		])
	})
})
