import { describe, expect, it, vi } from 'vitest'

import type { Prisma } from '../../generated/prisma/client'
import { EntryNotFoundException } from './entries.exceptions'
import { EntriesRepository } from './entries.repository'
import { EntriesService } from './entries.service'
import type { NewFoodEntry } from './entries.types'

const TX = {} as Prisma.TransactionClient
const DAY = new Date('2026-11-18T00:00:00Z')

const createNewEntry = (overrides: Partial<NewFoodEntry> = {}): NewFoodEntry => ({
	name: 'Борщ',
	grams: 300,
	quantity: null,
	kcal: 150,
	protein: 6,
	fat: 5,
	carbs: 20,
	fiber: null,
	category: 'soup',
	source: 'MEMORY',
	confidence: 0.9,
	assumption: null,
	myFoodId: null,
	fromPhoto: false,
	...overrides,
})

const createRow = (overrides: Record<string, unknown> = {}) => ({
	id: 'e1',
	userId: 'u1',
	name: 'Борщ',
	grams: 300,
	quantity: null,
	kcal: 150,
	proteinG: 6,
	fatG: 5,
	carbsG: 20,
	fiberG: null,
	category: 'soup',
	source: 'MEMORY',
	confidence: 0.9,
	assumption: null,
	isEdited: false,
	copiedFromDate: null,
	isUndetailed: false,
	myFoodId: null,
	recipeId: null,
	sourceMessageId: null,
	myFood: null,
	recipe: null,
	...overrides,
})

describe('EntriesService.logEntries without a source message', () => {
	it('puts the entries into the day and returns the card of exactly the created ones', async () => {
		const createEntries = vi.fn().mockResolvedValue([createRow({ id: 'new' })])
		const findOrCreateMeal = vi.fn().mockResolvedValue({ id: 'meal-1' })
		const findMealWithEntries = vi.fn().mockResolvedValue({
			id: 'meal-1',
			type: 'LUNCH',
			localDate: DAY,
			eatenAt: DAY,
			entries: [
				createRow({ id: 'old', kcal: 50, sourceMessageId: 'm1' }),
				createRow({ id: 'new' }),
			],
		})
		const service = new EntriesService({
			findOrCreateMeal,
			createEntries,
			findMealWithEntries,
		} as unknown as EntriesRepository)

		const { meals, entryIds } = await service.logEntries(
			{
				userId: 'u1',
				sourceMessageId: null,
				getEatenAt: () => DAY,
				entries: [{ mealType: 'LUNCH', localDate: DAY, entry: createNewEntry({ recipeId: 'r1' }) }],
			},
			TX,
		)

		expect(findOrCreateMeal).toHaveBeenCalledWith(
			expect.objectContaining({ userId: 'u1', sourceMessageId: null }),
			TX,
		)
		expect(createEntries).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceMessageId: null,
				entries: [expect.objectContaining({ recipeId: 'r1' })],
			}),
			TX,
		)
		expect(entryIds).toEqual(['new'])
		expect(meals).toHaveLength(1)
		expect(meals[0]?.entries.map(({ id }) => id)).toEqual(['new'])
		expect(meals[0]?.mealTotalKcal).toBe(200)
	})
})

describe('EntriesService.getRememberableEntries', () => {
	const createService = (rows: unknown[]) => {
		const findVisibleEntries = vi.fn().mockResolvedValue(rows)
		const service = new EntriesService({ findVisibleEntries } as unknown as EntriesRepository)
		return { service, findVisibleEntries }
	}

	it('leaves out «Без деталей» and a portion of an active recipe, keeps the rest in order', async () => {
		const { service } = createService([
			createRow({ id: 'plain' }),
			createRow({ id: 'rest', isUndetailed: true }),
			createRow({ id: 'portion', recipeId: 'r1', recipe: { deletedAt: null } }),
			createRow({ id: 'orphan', recipeId: 'r2', recipe: { deletedAt: new Date() } }),
			createRow({ id: 'linked', myFoodId: 'f1', myFood: { deletedAt: null } }),
		])

		const entries = await service.getRememberableEntries(
			'u1',
			['linked', 'orphan', 'rest', 'portion', 'plain'],
			TX,
		)

		// the one linked to an active food stays: remembering reports it as skipped «exists»
		expect(entries.map(({ id }) => id)).toEqual(['linked', 'orphan', 'plain'])
	})

	it('drops a portion of an active recipe even when it is also linked to an active food', async () => {
		const { service } = createService([
			createRow({
				id: 'both',
				myFoodId: 'f1',
				myFood: { deletedAt: null },
				recipeId: 'r1',
				recipe: { deletedAt: null },
			}),
		])

		expect(await service.getRememberableEntries('u1', ['both'], TX)).toEqual([])
	})

	it('still fails with not found for an id that is not visible', async () => {
		const { service } = createService([createRow({ id: 'plain' })])

		await expect(
			service.getRememberableEntries('u1', ['plain', 'gone'], TX),
		).rejects.toBeInstanceOf(EntryNotFoundException)
	})
})
