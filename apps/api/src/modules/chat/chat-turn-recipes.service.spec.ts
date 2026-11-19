import type { SaveRecipeInput } from '@kus/shared'
import { describe, expect, it, vi } from 'vitest'

import type { Prisma } from '../../generated/prisma/client'
import type { RecipesSaveService } from '../recipes/recipes-save.service'
import type { RecipesService } from '../recipes/recipes.service'
import { ChatTurnRecipesService } from './chat-turn-recipes.service'

const TX = {} as Prisma.TransactionClient
const USER_ID = 'user-1'
const NOW = new Date('2026-11-19T12:00:00Z')

const setup = () => {
	const markUsed = vi.fn().mockResolvedValue(undefined)
	const saveFromEntry = vi.fn().mockResolvedValue({ id: 'recipe-1', name: 'Суп', replaced: false })
	const saveFromBody = vi.fn().mockResolvedValue({ id: 'recipe-2', name: 'Борщ', replaced: false })
	const service = new ChatTurnRecipesService(
		{ markUsed } as unknown as RecipesService,
		{ saveFromEntry, saveFromBody } as unknown as RecipesSaveService,
	)
	return { service, markUsed, saveFromEntry, saveFromBody }
}

const body = {
	ingredients: [
		{ name: 'Філе', grams: 410, kcal: 450, protein: 90, fat: 6, carbs: 0, fiber: null },
	],
	waterMl: 3000,
	cookedGrams: null,
	servings: null,
}

const input = (overrides: Partial<SaveRecipeInput>): SaveRecipeInput => ({
	name: 'Суп',
	aliases: ['супчик'],
	category: 'soup',
	entryRef: null,
	recipe: null,
	portionGrams: null,
	...overrides,
})

const saveParams = (recipes: SaveRecipeInput[]) => ({
	userId: USER_ID,
	messageId: 'message-1',
	recipes,
	entryIdByRef: new Map([['e1', 'entry-1']]),
})

describe('ChatTurnRecipesService.save', () => {
	it('saves a pot logged earlier by the id the ref stands for in this request', async () => {
		const { service, saveFromEntry } = setup()

		const saved = await service.save(saveParams([input({ entryRef: 'e1' })]), TX)

		expect(saved).toEqual([{ id: 'recipe-1', name: 'Суп', replaced: false }])
		expect(saveFromEntry).toHaveBeenCalledWith(
			{
				userId: USER_ID,
				entryId: 'entry-1',
				identity: { name: 'Суп', aliases: ['супчик'], category: 'soup' },
				messageId: 'message-1',
			},
			TX,
		)
	})

	it('saves ingredients the model sent, with the portion weight', async () => {
		const { service, saveFromBody } = setup()

		await service.save(saveParams([input({ recipe: body, portionGrams: 350 })]), TX)

		expect(saveFromBody).toHaveBeenCalledWith(
			expect.objectContaining({ userId: USER_ID, body, portionGrams: 350, messageId: 'message-1' }),
			TX,
		)
	})

	it('rejects an entryRef the request did not map instead of swallowing it', async () => {
		const { service, saveFromEntry } = setup()

		await expect(service.save(saveParams([input({ entryRef: 'e9' })]), TX)).rejects.toThrow(
			'entryRef is not mapped',
		)
		expect(saveFromEntry).not.toHaveBeenCalled()
	})
})

describe('ChatTurnRecipesService.markUsed', () => {
	const item = (recipeRef: string | null) => ({ recipeRef }) as never

	it('counts each saved recipe once, whatever the number of portions', async () => {
		const { service, markUsed } = setup()
		const byRef = new Map([['r1', { id: 'recipe-1' }]]) as never

		await service.markUsed(
			{ userId: USER_ID, items: [item('r1'), item('r1'), item(null)], byRef, usedAt: NOW },
			TX,
		)

		expect(markUsed).toHaveBeenCalledWith({ userId: USER_ID, ids: ['recipe-1'], usedAt: NOW }, TX)
	})

	it('counts nothing for items without a recipeRef', async () => {
		const { service, markUsed } = setup()

		await service.markUsed(
			{ userId: USER_ID, items: [item(null)], byRef: new Map(), usedAt: NOW },
			TX,
		)

		expect(markUsed).toHaveBeenCalledWith({ userId: USER_ID, ids: [], usedAt: NOW }, TX)
	})
})
