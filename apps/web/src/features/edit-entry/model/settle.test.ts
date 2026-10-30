import type { FoodEntryResponse, LoggedMeal } from '@kus/shared'
import { beforeEach, describe, expect, it } from 'vitest'

import { applyEntryChange } from './apply-entry-change'
import { useEditEntryStore } from './edit-entry-store'

const makeEntry = (id: string, kcal: number): FoodEntryResponse => ({
	id,
	name: id,
	grams: 100,
	quantity: null,
	kcal,
	protein: 10,
	fat: 5,
	carbs: 20,
	fiber: 1,
	category: 'plate',
	source: 'ESTIMATE',
	confidence: 0.8,
	assumption: null,
	isEdited: false,
	copiedFromDate: null,
	isUndetailed: false,
	canRemember: false,
})

const makeMeal = (mealTotalKcal: number | null = null): LoggedMeal => ({
	id: '0199b3a4-0000-7000-8000-000000000001',
	type: 'DINNER',
	localDate: '2026-10-05',
	eatenAt: '2026-10-05T16:40:00.000Z',
	totals: { kcal: 450, protein: 30, fat: 15, carbs: 60, fiber: 3 },
	mealTotalKcal,
	entries: [makeEntry('a', 100), makeEntry('b', 150), makeEntry('c', 200)],
})

describe('applyEntryChange', () => {
	it('drops a removed entry and re-sums the totals', () => {
		const next = applyEntryChange(makeMeal(), { kind: 'removed', entryId: 'b' })

		expect(next?.entries.map((entry) => entry.id)).toEqual(['a', 'c'])
		expect(next?.totals).toEqual({ kcal: 300, protein: 20, fat: 10, carbs: 40, fiber: 2 })
	})

	it('replaces an updated entry and moves mealTotalKcal by the difference', () => {
		const next = applyEntryChange(makeMeal(900), {
			kind: 'updated',
			entry: makeEntry('b', 225),
		})

		expect(next?.entries.find((entry) => entry.id === 'b')?.kcal).toBe(225)
		expect(next?.totals.kcal).toBe(525)
		expect(next?.mealTotalKcal).toBe(975)
	})

	it('is null when the last entry is gone', () => {
		const single = { ...makeMeal(), entries: [makeEntry('a', 100)] }

		expect(applyEntryChange(single, { kind: 'removed', entryId: 'a' })).toBeNull()
	})
})

describe('useEditEntryStore.settle', () => {
	beforeEach(() => {
		useEditEntryStore.setState({ target: null })
	})

	it('goes back to the picker with the rest of the meal when the form came from it', () => {
		const { open, selectEntry, settle } = useEditEntryStore.getState()
		open({ meal: makeMeal(), entryId: null })
		selectEntry('b')

		settle({ kind: 'removed', entryId: 'b' })

		const { target } = useEditEntryStore.getState()
		expect(target?.entryId).toBeNull()
		expect(target?.meal.entries.map((entry) => entry.id)).toEqual(['a', 'c'])
	})

	it('returns to the picker unchanged when nothing was saved', () => {
		const { open, selectEntry, settle } = useEditEntryStore.getState()
		open({ meal: makeMeal(), entryId: null })
		selectEntry('a')

		settle(null)

		expect(useEditEntryStore.getState().target?.meal.entries).toHaveLength(3)
	})

	it('closes when the last entry of the meal is deleted', () => {
		const { open, selectEntry, settle } = useEditEntryStore.getState()
		open({
			meal: { ...makeMeal(), entries: [makeEntry('a', 100), makeEntry('b', 150)] },
			entryId: null,
		})
		selectEntry('a')
		settle({ kind: 'removed', entryId: 'a' })
		useEditEntryStore.getState().selectEntry('b')

		useEditEntryStore.getState().settle({ kind: 'removed', entryId: 'b' })

		expect(useEditEntryStore.getState().target).toBeNull()
	})

	it('closes at once when the form was opened directly on a line', () => {
		const { open, settle } = useEditEntryStore.getState()
		open({ meal: makeMeal(), entryId: 'a' })

		settle({ kind: 'removed', entryId: 'a' })

		expect(useEditEntryStore.getState().target).toBeNull()
	})
})
