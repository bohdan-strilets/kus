import { describe, expect, it } from 'vitest'

import type { FoodEntry } from '../../generated/prisma/client'
import type { SaveFoodInput } from '@kus/shared'

import {
	compareByName,
	isFoodMatchingQuery,
	toMyFoodUpdate,
	toNewChatFood,
	toNewMyFood,
} from './my-foods.utils'

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

const createInput = (overrides: Partial<SaveFoodInput> = {}): SaveFoodInput => ({
	name: 'Кабаноси',
	aliases: [],
	per100g: { kcal: 550.04, protein: 20, fat: 45, carbs: 3, fiber: null },
	pieceGrams: null,
	defaultGrams: null,
	category: 'sausage',
	fromItemIndex: null,
	updateRef: null,
	...overrides,
})

describe('toNewChatFood', () => {
	it('takes the values of the call; LABEL when the message has a photo, else MANUAL', () => {
		expect(toNewChatFood(createInput(), { entry: undefined, hasPhoto: false })).toMatchObject({
			name: 'Кабаноси',
			nameNormalized: 'кабаноси',
			kcalPer100g: 550,
			source: 'MANUAL',
			category: 'sausage',
		})
		expect(toNewChatFood(createInput(), { entry: undefined, hasPhoto: true })?.source).toBe('LABEL')
	})

	it('stores aliases normalized, without the name itself and repeats, and no brand', () => {
		const food = toNewChatFood(createInput({ aliases: [' Кабанос ', 'кабанос', 'Кабаноси'] }), {
			entry: undefined,
			hasPhoto: false,
		})

		expect(food).toMatchObject({ brand: null, aliases: ['кабанос'] })
	})

	it('takes the values of the entry (per 100 g, piece, usual portion) under the name of the call', () => {
		const food = toNewChatFood(
			createInput({ name: 'Яйця', per100g: null, category: null, fromItemIndex: 0 }),
			{ entry: createEntry({ name: 'Яйце варене', grams: 150, quantity: 3 }), hasPhoto: false },
		)

		expect(food).toMatchObject({
			name: 'Яйця',
			nameNormalized: 'яйця',
			kcalPer100g: 80,
			pieceGrams: 50,
			defaultGrams: 150,
			category: 'yogurt',
			source: 'AI',
		})
	})

	it('lets the call set the piece and the usual portion over the entry', () => {
		const food = toNewChatFood(
			createInput({
				per100g: null,
				category: null,
				fromItemIndex: 0,
				pieceGrams: 40,
				defaultGrams: 80,
			}),
			{ entry: createEntry({ quantity: 3 }), hasPhoto: false },
		)

		expect(food).toMatchObject({ pieceGrams: 40, defaultGrams: 80 })
	})

	it('gives nothing without values, entry or category', () => {
		expect(
			toNewChatFood(createInput({ per100g: null }), { entry: undefined, hasPhoto: false }),
		).toBeNull()
		expect(
			toNewChatFood(createInput({ category: null }), { entry: undefined, hasPhoto: false }),
		).toBeNull()
	})
})

describe('toMyFoodUpdate', () => {
	it('overwrites the values but never the name, and keeps what the call did not say', () => {
		const data = toNewChatFood(createInput(), { entry: undefined, hasPhoto: false })
		if (!data) throw new Error('expected a food')

		const update = toMyFoodUpdate(data)

		expect(update).toMatchObject({ kcalPer100g: 550, category: 'sausage', source: 'MANUAL' })
		expect(update).not.toHaveProperty('name')
		expect(update).not.toHaveProperty('pieceGrams')
		expect(update).not.toHaveProperty('brand')
		expect(update).not.toHaveProperty('aliases')
	})

	it('sets the piece, the usual portion and the aliases when the call has them', () => {
		const data = toNewChatFood(
			createInput({ pieceGrams: 25, defaultGrams: 50, aliases: ['кабанос'] }),
			{ entry: undefined, hasPhoto: false },
		)
		if (!data) throw new Error('expected a food')

		expect(toMyFoodUpdate(data)).toMatchObject({
			pieceGrams: 25,
			defaultGrams: 50,
			aliases: ['кабанос'],
		})
	})
})
