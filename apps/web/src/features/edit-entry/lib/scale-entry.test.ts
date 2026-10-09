import { foodEntryResponseSchema } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { getScaledValues } from './scale-entry'

const buckwheat = foodEntryResponseSchema.parse({
	id: '0199b3a4-0000-7000-8000-000000000003',
	name: 'Гречка варена',
	grams: 100,
	quantity: null,
	kcal: 110,
	protein: 4.2,
	fat: 1.1,
	carbs: 19.9,
	fiber: 2.7,
	category: 'porridge',
	source: 'REFERENCE',
	confidence: 0.8,
	assumption: null,
	isEdited: false,
})

describe('getScaledValues', () => {
	it('rescales kcal and every macro by the new weight', () => {
		expect(getScaledValues(buckwheat, 150)).toEqual({
			grams: 150,
			kcal: 165,
			protein: 6.3,
			fat: 1.7,
			carbs: 29.9,
			fiber: 4.1,
		})
	})

	it('keeps the numbers at the same weight and a null fiber', () => {
		expect(getScaledValues({ ...buckwheat, fiber: null }, 100)).toEqual({
			grams: 100,
			kcal: 110,
			protein: 4.2,
			fat: 1.1,
			carbs: 19.9,
			fiber: null,
		})
	})
})
