import { describe, expect, it } from 'vitest'

import { distributeOptionValues, type EntryValues } from './option-values.js'
import type { ClarifyOption } from './tools.js'

const buckwheat: EntryValues = { grams: 100, kcal: 110, protein: 4, fat: 1, carbs: 21, fiber: 3 }
const soup: EntryValues = { grams: 300, kcal: 150, protein: 6, fat: 6, carbs: 18, fiber: null }

const option = (values: Partial<ClarifyOption>): ClarifyOption => ({
	label: 'x',
	kcal: 0,
	protein: 0,
	fat: 0,
	carbs: 0,
	fiber: null,
	grams: null,
	name: null,
	...values,
})

describe('distributeOptionValues', () => {
	it('puts the answer straight into a single entry: cooked → dry', () => {
		const dry = option({ kcal: 343, protein: 13, fat: 3.4, carbs: 62, fiber: 10 })
		expect(distributeOptionValues([buckwheat], dry)).toEqual([
			{ grams: 100, kcal: 343, protein: 13, fat: 3.4, carbs: 62, fiber: 10 },
		])
	})

	it('changes only fat and kcal for "with oil"', () => {
		const withOil = option({ kcal: 240, protein: 6, fat: 16, carbs: 18 })
		const [updated] = distributeOptionValues([soup], withOil) ?? []
		expect(updated).toEqual({ ...soup, kcal: 240, fat: 16 })
	})

	it('changes grams only when the answer is about the portion size', () => {
		const large = option({ kcal: 250, protein: 10, fat: 10, carbs: 30, grams: 500 })
		expect(distributeOptionValues([soup], large)?.[0]?.grams).toBe(500)
	})

	it('splits the totals by current kcal and the grams by current grams', () => {
		const both = option({ kcal: 520, protein: 20, fat: 14, carbs: 78, grams: 800 })
		const [first, second] = distributeOptionValues([buckwheat, soup], both) ?? []
		// 110 : 150 of kcal, 100 : 300 of grams
		expect(first).toMatchObject({ kcal: 220, grams: 200, protein: 8.5 })
		expect(second).toMatchObject({ kcal: 300, grams: 600, protein: 11.5 })
	})

	it('refuses an answer that would make an entry denser than 9.5 kcal/g', () => {
		expect(distributeOptionValues([buckwheat], option({ kcal: 1200, fat: 133 }))).toBeNull()
	})

	it('refuses an answer about no entries', () => {
		expect(distributeOptionValues([], option({ kcal: 100 }))).toBeNull()
	})
})
