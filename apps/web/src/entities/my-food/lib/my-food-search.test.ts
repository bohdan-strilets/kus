import type { MyFoodResponse } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import {
	filterMyFoods,
	MY_FOODS_SEARCH_THRESHOLD,
	normalizeForSearch,
	shouldShowSearch,
	sortMyFoodsByName,
} from './my-food-search'

const createFood = (name: string): MyFoodResponse => ({
	id: '0199b3a4-0000-7000-8000-000000000001',
	name,
	brand: null,
	aliases: [],
	per100g: { kcal: 280, protein: 24, fat: 20, carbs: 2, fiber: null },
	pieceGrams: null,
	defaultGrams: null,
	category: 'eggs',
	source: 'MANUAL',
	updatedAt: '2026-10-30T10:00:00.000Z',
})

describe('normalizeForSearch', () => {
	it('ignores case, diacritics and the stroke of «ł»', () => {
		expect(normalizeForSearch('Kabanosy Tarczyński')).toBe('kabanosy tarczynski')
		expect(normalizeForSearch('  Łódź ')).toBe('lodz')
	})
})

describe('filterMyFoods', () => {
	const foods = [
		createFood('Кабаноси Tarczyński'),
		createFood('Кабаноси Krakus'),
		createFood('Гумус Lavica'),
	]

	it('finds by a part of the name, in any case and without diacritics', () => {
		expect(filterMyFoods(foods, 'кабан')).toHaveLength(2)
		expect(filterMyFoods(foods, 'TARCZYNSKI').map((food) => food.name)).toEqual([
			'Кабаноси Tarczyński',
		])
	})

	it('keeps everything for an empty query and nothing for an unknown one', () => {
		expect(filterMyFoods(foods, '  ')).toHaveLength(3)
		expect(filterMyFoods(foods, 'сирок ваніль')).toEqual([])
	})
})

describe('sortMyFoodsByName', () => {
	it('sorts by name without touching the source', () => {
		const foods = [createFood('Яблуко'), createFood('Банан'), createFood('гумус')]

		expect(sortMyFoodsByName(foods).map((food) => food.name)).toEqual(['Банан', 'гумус', 'Яблуко'])
		expect(foods[0]?.name).toBe('Яблуко')
	})
})

describe('shouldShowSearch', () => {
	it('shows the search past 15 foods only', () => {
		expect(shouldShowSearch(MY_FOODS_SEARCH_THRESHOLD)).toBe(false)
		expect(shouldShowSearch(MY_FOODS_SEARCH_THRESHOLD + 1)).toBe(true)
	})
})
