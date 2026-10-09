import { loggedMealSchema } from '@kus/shared'
import { beforeEach, describe, expect, it } from 'vitest'

import { useEditEntryStore } from './edit-entry-store'

const meal = loggedMealSchema.parse({
	id: '0199b3a4-0000-7000-8000-000000000001',
	type: 'BREAKFAST',
	localDate: '2026-10-05',
	eatenAt: '2026-10-05T06:40:00.000Z',
	totals: { kcal: 110, protein: 4, fat: 1, carbs: 21, fiber: 3 },
	mealTotalKcal: null,
	entries: [
		{
			id: '0199b3a4-0000-7000-8000-000000000003',
			name: 'Гречка варена',
			grams: 100,
			quantity: null,
			kcal: 110,
			protein: 4,
			fat: 1,
			carbs: 21,
			fiber: 3,
			category: 'porridge',
			source: 'REFERENCE',
			confidence: 0.8,
			assumption: null,
			isEdited: false,
		},
	],
})

describe('useEditEntryStore', () => {
	beforeEach(() => {
		useEditEntryStore.setState({ target: null })
	})

	it('opens on a meal, picks an entry in it and closes', () => {
		const { open, selectEntry, close } = useEditEntryStore.getState()
		open({ meal, entryId: null })
		expect(useEditEntryStore.getState().target).toEqual({ meal, entryId: null })

		selectEntry(meal.entries[0]?.id ?? '')
		expect(useEditEntryStore.getState().target?.entryId).toBe(meal.entries[0]?.id)

		close()
		expect(useEditEntryStore.getState().target).toBeNull()
	})

	it('ignores a pick while nothing is open', () => {
		useEditEntryStore.getState().selectEntry('anything')
		expect(useEditEntryStore.getState().target).toBeNull()
	})
})
