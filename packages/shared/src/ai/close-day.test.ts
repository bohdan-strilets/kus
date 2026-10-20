import { describe, expect, it } from 'vitest'

import { isMacrosConsistent, MAX_KCAL_PER_GRAM } from '../schemas/food-entry.js'
import { getUndetailedEntryValues, UNDETAILED_ENTRY_CATEGORY } from './close-day.js'

describe('getUndetailedEntryValues', () => {
	it.each([50, 400, 1234, 3000])('is a consistent entry for %i kcal', (kcal) => {
		const values = getUndetailedEntryValues(kcal)
		expect(values.kcal).toBe(kcal)
		expect(values.kcal / values.grams).toBeLessThanOrEqual(MAX_KCAL_PER_GRAM)
		expect(
			isMacrosConsistent({
				...values,
				fiber: null,
				category: UNDETAILED_ENTRY_CATEGORY,
				source: 'ESTIMATE',
			}),
		).toBe(true)
	})

	it('splits the kcal 20 / 50 / 30 between protein, carbs and fat', () => {
		const { protein, carbs, fat } = getUndetailedEntryValues(1000)
		expect([protein * 4, carbs * 4, fat * 9].map(Math.round)).toEqual([200, 500, 300])
	})

	it('never goes below the minimal grams', () => {
		expect(getUndetailedEntryValues(1).grams).toBeGreaterThanOrEqual(1)
	})
})
