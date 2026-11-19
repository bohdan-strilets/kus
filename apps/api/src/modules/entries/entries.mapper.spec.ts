import { describe, expect, it } from 'vitest'

import type { FoodEntry } from '../../generated/prisma/client'
import { toFoodEntryResponse, toLoggedMeal } from './entries.mapper'
import type { MealWithEntries } from './entries.repository'

const FOOD_ID = '0190f3a0-0000-7000-8000-000000000002'
const RECIPE_ID = '0190f3a0-0000-7000-8000-000000000003'

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
		recipeId: null,
		potId: null,
		sourceMessageId: null,
		...overrides,
	}) as FoodEntry

describe('toFoodEntryResponse canRemember', () => {
	it("offers «Запам'ятати» for an entry not linked to a saved food", () => {
		expect(toFoodEntryResponse(createEntry()).canRemember).toBe(true)
	})

	it('hides it for an entry of a saved food', () => {
		const entry = { ...createEntry({ myFoodId: FOOD_ID }), myFood: { deletedAt: null } }

		expect(toFoodEntryResponse(entry).canRemember).toBe(false)
	})

	it('offers it again once the saved food is deleted', () => {
		const entry = { ...createEntry({ myFoodId: FOOD_ID }), myFood: { deletedAt: new Date() } }

		expect(toFoodEntryResponse(entry).canRemember).toBe(true)
	})

	it('keeps it hidden for a linked entry read without its food', () => {
		expect(toFoodEntryResponse(createEntry({ myFoodId: FOOD_ID })).canRemember).toBe(false)
	})

	it('hides it for «Без деталей», the rest of a day', () => {
		expect(toFoodEntryResponse(createEntry({ isUndetailed: true })).canRemember).toBe(false)
	})

	it('hides it for a portion of a saved recipe', () => {
		const entry = { ...createEntry({ recipeId: RECIPE_ID }), recipe: { deletedAt: null } }

		expect(toFoodEntryResponse(entry).canRemember).toBe(false)
	})

	it('keeps it hidden for a recipe portion read without its recipe', () => {
		expect(toFoodEntryResponse(createEntry({ recipeId: RECIPE_ID })).canRemember).toBe(false)
	})

	it('offers it again once the recipe is deleted', () => {
		const entry = { ...createEntry({ recipeId: RECIPE_ID }), recipe: { deletedAt: new Date() } }

		expect(toFoodEntryResponse(entry).canRemember).toBe(true)
	})
})

describe('toLoggedMeal', () => {
	it('returns exactly the entries with the given ids, including ones without a source message', () => {
		const created = createEntry({ id: 'created', kcal: 100 })
		const other = createEntry({ id: 'other', kcal: 50, sourceMessageId: 'm1' })
		const meal = {
			id: 'meal-1',
			type: 'LUNCH',
			localDate: new Date('2026-11-18T00:00:00Z'),
			eatenAt: new Date('2026-11-18T12:00:00Z'),
			entries: [other, created],
		} as unknown as MealWithEntries

		const card = toLoggedMeal(meal, new Set(['created']))

		expect(card.entries.map(({ id }) => id)).toEqual(['created'])
		expect(card.totals.kcal).toBe(100)
		expect(card.mealTotalKcal).toBe(150)
	})
})

describe('toFoodEntryResponse canRemember for a pot portion', () => {
	const POT_ID = '0190f3a0-0000-7000-8000-000000000004'

	it('offers it for a portion of a pot whose recipe is not saved', () => {
		expect(toFoodEntryResponse(createEntry({ potId: POT_ID })).canRemember).toBe(true)
	})

	it('offers it even when the portion is still linked to a food', () => {
		const entry = {
			...createEntry({ potId: POT_ID, myFoodId: FOOD_ID }),
			myFood: { deletedAt: null },
		}

		expect(toFoodEntryResponse(entry).canRemember).toBe(true)
	})

	it('hides it once its recipe is saved and active', () => {
		const entry = {
			...createEntry({ potId: POT_ID, recipeId: RECIPE_ID }),
			recipe: { deletedAt: null },
		}

		expect(toFoodEntryResponse(entry).canRemember).toBe(false)
	})

	it('offers it again after the recipe was deleted', () => {
		const entry = {
			...createEntry({ potId: POT_ID, recipeId: RECIPE_ID }),
			recipe: { deletedAt: new Date() },
		}

		expect(toFoodEntryResponse(entry).canRemember).toBe(true)
	})
})
