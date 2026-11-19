import type { RecipeDraft } from '@kus/shared'
import { describe, expect, it, vi } from 'vitest'

import type { Prisma } from '../../generated/prisma/client'
import type { EntriesService } from '../entries/entries.service'
import type { PotEntriesService } from '../entries/pot-entries.service'
import { PotNotFoundException, RecipePortionInvalidException } from './recipes.exceptions'
import type { RecipesRepository } from './recipes.repository'
import { RecipesPotService } from './recipes-pot.service'

const TX = {} as Prisma.TransactionClient
const USER_ID = 'user-1'

const draft: RecipeDraft = {
	ingredients: [
		{ name: 'Філе', grams: 410, kcal: 450, protein: 90, fat: 6, carbs: 0, fiber: null },
		{ name: 'Картопля', grams: 500, kcal: 440, protein: 10, fat: 1, carbs: 100, fiber: null },
	],
	waterMl: 3000,
	cookedGrams: null,
	servings: null,
}

const entry = (overrides: Record<string, unknown> = {}) => ({
	id: 'entry-1',
	userId: USER_ID,
	potId: 'pot-1',
	grams: 500,
	recipeDraft: draft,
	meal: { type: 'LUNCH', localDate: new Date('2026-11-19T00:00:00Z') },
	...overrides,
})

const setup = (
	entries: unknown[] = [entry()],
	portions: unknown[] = [entry(), entry({ id: 'entry-2' })],
) => {
	const findActiveEntriesByIds = vi.fn().mockResolvedValue(entries)
	const findPortions = vi.fn().mockResolvedValue(portions)
	const recount = vi
		.fn()
		.mockResolvedValue({ sourceMessageIds: ['message-1'], recipeIds: [] as string[] })
	const updateCookedGrams = vi.fn().mockResolvedValue(undefined)
	const service = new RecipesPotService(
		{ updateCookedGrams } as unknown as RecipesRepository,
		{ findActiveEntriesByIds } as unknown as EntriesService,
		{ findPortions, recount } as unknown as PotEntriesService,
	)
	return { service, findActiveEntriesByIds, findPortions, recount, updateCookedGrams }
}

const correctWater = (
	service: RecipesPotService,
	waterMl: number | null,
	cookedGrams: number | null = null,
) =>
	service.correctPot(
		{
			userId: USER_ID,
			entryId: 'entry-1',
			correction: { waterMl, cookedGrams },
			messageId: 'message-2',
		},
		TX,
	)

describe('RecipesPotService.correctPot', () => {
	it('recounts every portion of the pot with the new water', async () => {
		const { service, recount, findPortions, findActiveEntriesByIds } = setup()

		const result = await correctWater(service, 4000)

		expect(findActiveEntriesByIds).toHaveBeenCalledWith(USER_ID, ['entry-1'], TX)
		expect(findPortions).toHaveBeenCalledWith(expect.objectContaining({ potId: 'pot-1' }), TX)
		expect(recount).toHaveBeenCalledWith(
			{
				portions: [
					expect.objectContaining({ id: 'entry-1' }),
					expect.objectContaining({ id: 'entry-2' }),
				],
				draft: { ...draft, waterMl: 4000 },
				messageId: 'message-2',
			},
			TX,
		)
		expect(result.sourceMessageIds).toEqual(['message-1'])
	})

	it('moves the weight of an active saved recipe along', async () => {
		const { service, recount, updateCookedGrams } = setup()
		recount.mockResolvedValue({ sourceMessageIds: [], recipeIds: ['recipe-1'] })

		await correctWater(service, 4000)

		expect(updateCookedGrams).toHaveBeenCalledWith(
			{ userId: USER_ID, ids: ['recipe-1'], cookedGrams: 4910 },
			TX,
		)
	})

	it('leaves recipes alone when no portion of the pot has one', async () => {
		const { service, updateCookedGrams } = setup()

		await correctWater(service, 4000)

		expect(updateCookedGrams).not.toHaveBeenCalled()
	})

	it.each([
		['is not the user`s or is deleted', []],
		['is not a portion of a pot', [entry({ potId: null })]],
		['has a broken composition', [entry({ recipeDraft: { waterMl: 3000 } })]],
	])('rejects an entry that %s', async (_label, entries) => {
		const { service, recount } = setup(entries)

		await expect(correctWater(service, 4000)).rejects.toThrow(PotNotFoundException)
		expect(recount).not.toHaveBeenCalled()
	})

	it('refuses a pot that would make a portion denser than 9.5 kcal/g', async () => {
		const { service, recount } = setup()

		await expect(correctWater(service, null, 50)).rejects.toThrow(RecipePortionInvalidException)
		expect(recount).not.toHaveBeenCalled()
	})
})

describe('RecipesPotService.findPotEntry', () => {
	it('returns the first entry that is a portion of a pot', async () => {
		const { service } = setup([entry({ id: 'plain', potId: null }), entry({ id: 'pot' })])

		expect((await service.findPotEntry(USER_ID, ['plain', 'pot'], TX))?.id).toBe('pot')
	})

	it('returns null when none is', async () => {
		const { service } = setup([entry({ potId: null })])

		expect(await service.findPotEntry(USER_ID, ['entry-1'], TX)).toBeNull()
	})
})
