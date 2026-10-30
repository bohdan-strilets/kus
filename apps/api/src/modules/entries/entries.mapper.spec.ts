import { describe, expect, it } from 'vitest'

import type { FoodEntry } from '../../generated/prisma/client'
import { toFoodEntryResponse } from './entries.mapper'

const createEntry = (overrides: Partial<FoodEntry> = {}): FoodEntry =>
	({
		id: '0190f3a0-0000-7000-8000-000000000001',
		name: 'Кабаноси',
		grams: 30,
		quantity: 2,
		kcal: 84,
		proteinG: 7,
		fatG: 6,
		carbsG: 1,
		fiberG: null,
		category: 'sausage',
		source: 'LABEL',
		confidence: 0.9,
		assumption: null,
		isEdited: false,
		copiedFromDate: null,
		isUndetailed: false,
		myFoodId: null,
		...overrides,
	}) as FoodEntry

describe('toFoodEntryResponse canRemember', () => {
	it("offers «Запам'ятати» for an entry not linked to a saved food", () => {
		expect(toFoodEntryResponse(createEntry()).canRemember).toBe(true)
	})

	it('hides it for an entry of a saved food', () => {
		const entry = createEntry({ myFoodId: '0190f3a0-0000-7000-8000-000000000002' })

		expect(toFoodEntryResponse(entry).canRemember).toBe(false)
	})

	it('hides it for «Без деталей», the rest of a day', () => {
		expect(toFoodEntryResponse(createEntry({ isUndetailed: true })).canRemember).toBe(false)
	})
})
