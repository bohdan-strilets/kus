import type { RecipeBody } from '@kus/shared'
import { describe, expect, it, vi } from 'vitest'

import type { Prisma } from '../../generated/prisma/client'
import type { EntriesService } from '../entries/entries.service'
import type { PotEntriesService } from '../entries/pot-entries.service'
import {
	RecipeFromEntryInvalidException,
	RecipeNameTakenException,
	RecipePortionUnknownException,
} from './recipes.exceptions'
import type { NewRecipe, RecipesRepository } from './recipes.repository'
import { RecipesSaveService } from './recipes-save.service'

const TX = {} as Prisma.TransactionClient
const USER_ID = 'user-1'
const MESSAGE_ID = 'message-1'
const identity = {
	name: 'Суп курячий',
	aliases: ['Супчик', 'суп курячий'],
	category: 'soup' as const,
}

const body: RecipeBody = {
	ingredients: [
		{ name: 'Філе', grams: 410, kcal: 450, protein: 90, fat: 6, carbs: 0, fiber: null },
		{ name: 'Картопля', grams: 500, kcal: 440, protein: 10, fat: 1, carbs: 100, fiber: 2 },
	],
	waterMl: 3000,
	cookedGrams: null,
	servings: null,
}

const potEntry = (overrides: Record<string, unknown> = {}) => ({
	id: 'entry-1',
	userId: USER_ID,
	potId: 'pot-1',
	grams: 350,
	recipeDraft: body,
	meal: { type: 'LUNCH', localDate: new Date('2026-11-19T00:00:00Z') },
	...overrides,
})

const setup = (entries: unknown[] = [potEntry()]) => {
	const created: NewRecipe[] = []
	const setDeletedAt = vi.fn().mockResolvedValue(true)
	const findActiveByNameInTx = vi.fn().mockResolvedValue(null)
	const createIfFree = vi.fn((data: NewRecipe) => {
		created.push(data)
		return Promise.resolve({ id: 'recipe-new', name: data.name })
	})
	const findActiveEntriesByIds = vi.fn().mockResolvedValue(entries)
	const linkRecipe = vi.fn().mockResolvedValue(3)
	const service = new RecipesSaveService(
		{ setDeletedAt, findActiveByNameInTx, createIfFree } as unknown as RecipesRepository,
		{ findActiveEntriesByIds } as unknown as EntriesService,
		{ linkRecipe } as unknown as PotEntriesService,
	)
	return {
		service,
		created,
		setDeletedAt,
		findActiveByNameInTx,
		createIfFree,
		linkRecipe,
		findActiveEntriesByIds,
	}
}

const saveFromEntry = (service: RecipesSaveService) =>
	service.saveFromEntry(
		{ userId: USER_ID, entryId: 'entry-1', identity, messageId: MESSAGE_ID },
		TX,
	)

describe('RecipesSaveService.saveFromEntry', () => {
	it('saves the composition with the weight of the portion eaten as the default portion', async () => {
		const { service, created, findActiveEntriesByIds } = setup()

		const saved = await saveFromEntry(service)

		expect(saved).toEqual({ id: 'recipe-new', name: 'Суп курячий', replaced: false })
		expect(findActiveEntriesByIds).toHaveBeenCalledWith(USER_ID, ['entry-1'], TX)
		const [recipe] = created
		expect(recipe).toMatchObject({
			userId: USER_ID,
			name: 'Суп курячий',
			nameNormalized: 'суп курячий',
			aliases: ['супчик'],
			category: 'soup',
			defaultGrams: 350,
			cookedGrams: 3910,
			usageCount: 0,
			lastUsedAt: null,
			sourceMessageId: MESSAGE_ID,
		})
		expect(recipe?.ingredients).toHaveLength(2)
		expect(recipe?.ingredients[1]).toEqual({
			name: 'Картопля',
			grams: 500,
			kcal: 440,
			proteinG: 10,
			fatG: 1,
			carbsG: 100,
			fiberG: 2,
		})
	})

	it('links the portions of the pot to the new recipe', async () => {
		const { service, linkRecipe } = setup()

		await saveFromEntry(service)

		expect(linkRecipe).toHaveBeenCalledWith(
			{
				entry: expect.objectContaining({ potId: 'pot-1' }) as unknown,
				recipeId: 'recipe-new',
				replacedRecipeId: null,
			},
			TX,
		)
	})

	it('replaces the active recipe of the same name: soft deletes it, the counters move on', async () => {
		const { service, created, setDeletedAt, findActiveByNameInTx, linkRecipe } = setup()
		const usedAt = new Date('2026-11-10T12:00:00Z')
		findActiveByNameInTx.mockResolvedValue({ id: 'recipe-old', usageCount: 4, lastUsedAt: usedAt })

		const saved = await saveFromEntry(service)
		expect(saved.replaced).toBe(true)

		expect(setDeletedAt).toHaveBeenCalledWith(
			{ userId: USER_ID, id: 'recipe-old', deletedAt: expect.any(Date) as unknown },
			TX,
		)
		expect(findActiveByNameInTx).toHaveBeenCalledWith(
			{ userId: USER_ID, nameNormalized: 'суп курячий' },
			TX,
		)
		expect(created[0]).toMatchObject({ usageCount: 4, lastUsedAt: usedAt })
		expect(linkRecipe).toHaveBeenCalledWith(
			expect.objectContaining({ recipeId: 'recipe-new', replacedRecipeId: 'recipe-old' }),
			TX,
		)
	})

	it('deletes the old recipe before the new one is created (the partial unique allows one)', async () => {
		const { service, setDeletedAt, createIfFree, findActiveByNameInTx } = setup()
		findActiveByNameInTx.mockResolvedValue({ id: 'recipe-old', usageCount: 0, lastUsedAt: null })

		await saveFromEntry(service)

		const deletedAt = setDeletedAt.mock.invocationCallOrder[0] ?? 0
		const createdAt = createIfFree.mock.invocationCallOrder[0] ?? 0
		expect(deletedAt).toBeLessThan(createdAt)
	})

	it.each([
		['is not found (another user or deleted)', []],
		['is not a portion of a pot', [potEntry({ potId: null })]],
		['has no readable composition', [potEntry({ recipeDraft: { ingredients: [] } })]],
	])('rejects an entry that %s', async (_label, entries) => {
		const { service, createIfFree } = setup(entries)

		await expect(saveFromEntry(service)).rejects.toThrow(RecipeFromEntryInvalidException)
		expect(createIfFree).not.toHaveBeenCalled()
	})

	it('fails when a parallel save took the name', async () => {
		const { service, createIfFree, findActiveByNameInTx } = setup()
		createIfFree.mockResolvedValueOnce(null as never)
		findActiveByNameInTx.mockResolvedValue({ id: 'holder', usageCount: 0, lastUsedAt: null })

		await expect(saveFromEntry(service)).rejects.toThrow(RecipeNameTakenException)
	})
})

describe('RecipesSaveService.saveFromBody', () => {
	it('takes the portion weight the model said', async () => {
		const { service, created, linkRecipe } = setup()

		await service.saveFromBody(
			{ userId: USER_ID, body, portionGrams: 400, identity, messageId: MESSAGE_ID },
			TX,
		)

		expect(created[0]).toMatchObject({ defaultGrams: 400, cookedGrams: 3910 })
		expect(linkRecipe).not.toHaveBeenCalled()
	})

	it('falls back to the pot divided by its servings', async () => {
		const { service, created } = setup()

		await service.saveFromBody(
			{
				userId: USER_ID,
				body: { ...body, waterMl: null, cookedGrams: 3000, servings: 6 },
				portionGrams: null,
				identity,
				messageId: MESSAGE_ID,
			},
			TX,
		)

		expect(created[0]).toMatchObject({ defaultGrams: 500, cookedGrams: 3000 })
	})

	it('never saves a recipe without the weight of a portion', async () => {
		const { service, createIfFree } = setup()

		await expect(
			service.saveFromBody(
				{ userId: USER_ID, body, portionGrams: null, identity, messageId: MESSAGE_ID },
				TX,
			),
		).rejects.toThrow(RecipePortionUnknownException)
		expect(createIfFree).not.toHaveBeenCalled()
	})
})
