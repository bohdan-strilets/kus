import { describe, expect, it, vi } from 'vitest'

import type { Prisma } from '../../generated/prisma/client'
import type { EntriesService } from '../entries/entries.service'
import type { UsersService } from '../users/users.service'
import { RECIPE_ENTRY_CONFIDENCE } from './recipes.constants'
import { RecipesService } from './recipes.service'
import type { RecipesRepository, RecipeWithIngredients } from './recipes.repository'

const USER_ID = 'u1'
const RECIPE_ID = 'r1'
const TX = {} as Prisma.TransactionClient

const ingredient = (grams: number, kcal: number, position: number) => ({
	id: `i${position}`,
	recipeId: RECIPE_ID,
	myFoodId: null,
	name: `Ingredient ${position}`,
	grams,
	kcal,
	proteinG: kcal / 10,
	fatG: kcal / 20,
	carbsG: kcal / 8,
	fiberG: null,
	position,
	createdAt: new Date(),
	updatedAt: new Date(),
})

const makeRecipe = (overrides: Partial<RecipeWithIngredients> = {}): RecipeWithIngredients => ({
	id: RECIPE_ID,
	userId: USER_ID,
	name: 'Борщ',
	nameNormalized: 'борщ',
	aliases: [],
	cookedGrams: 1000,
	defaultGrams: 400,
	category: 'soup',
	usageCount: 2,
	lastUsedAt: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	deletedAt: null,
	ingredients: [ingredient(500, 600, 0), ingredient(500, 400, 1)],
	...overrides,
})

const LOGGED_ENTRY = { id: 'e1' }

const makeService = (repository: Partial<Record<keyof RecipesRepository, unknown>>) => {
	const logEntries = vi.fn().mockResolvedValue({
		meals: [{ type: 'LUNCH', entries: [LOGGED_ENTRY] }],
		entryIds: ['e1'],
	})
	const prisma = { $transaction: (fn: (tx: Prisma.TransactionClient) => unknown) => fn(TX) }
	const usersService = { getMe: vi.fn().mockResolvedValue({ timezone: 'Europe/Warsaw' }) }
	const service = new RecipesService(
		prisma as never,
		repository as unknown as RecipesRepository,
		{ logEntries } as unknown as EntriesService,
		usersService as unknown as UsersService,
	)
	return { service, logEntries }
}

describe('RecipesService.logPortion', () => {
	it('writes the share of the portion as a recipe entry and marks the recipe used', async () => {
		const markUsed = vi.fn()
		const { service, logEntries } = makeService({
			findActive: vi.fn().mockResolvedValue(makeRecipe()),
			markUsed,
		})

		const response = await service.logPortion(USER_ID, RECIPE_ID, 1.5)

		// 1.5 × 400 g of a 1000 g pot with 1000 kcal in total
		const [params, tx] = logEntries.mock.calls[0] as [
			{
				sourceMessageId: null
				entries: { entry: Record<string, unknown> }[]
			},
			unknown,
		]
		expect(tx).toBe(TX)
		expect(params.sourceMessageId).toBeNull()
		expect(params.entries[0]?.entry).toMatchObject({
			name: 'Борщ',
			grams: 600,
			kcal: 600,
			recipeId: RECIPE_ID,
			myFoodId: null,
			source: 'MEMORY',
			confidence: RECIPE_ENTRY_CONFIDENCE,
		})
		const [usage, usageTx] = markUsed.mock.calls[0] as [
			{ userId: string; id: string; usedAt: Date },
			unknown,
		]
		expect(usageTx).toBe(TX)
		expect(usage).toMatchObject({ userId: USER_ID, id: RECIPE_ID })
		expect(usage.usedAt).toBeInstanceOf(Date)
		expect(response.entry).toBe(LOGGED_ENTRY)
		expect(response.mealType).toBe('LUNCH')
	})

	it('counts the whole dish as one portion when defaultGrams is not saved', async () => {
		const { service, logEntries } = makeService({
			findActive: vi.fn().mockResolvedValue(makeRecipe({ defaultGrams: null })),
			markUsed: vi.fn(),
		})

		await service.logPortion(USER_ID, RECIPE_ID, 0.5)

		const [params] = logEntries.mock.calls[0] as [{ entries: { entry: { grams: number } }[] }]
		expect(params.entries[0]?.entry.grams).toBe(500)
	})

	it('answers not found for another user or deleted recipe and writes nothing', async () => {
		const { service, logEntries } = makeService({ findActive: vi.fn().mockResolvedValue(null) })

		await expect(service.logPortion('other', RECIPE_ID, 1)).rejects.toMatchObject({
			status: 404,
		})
		expect(logEntries).not.toHaveBeenCalled()
	})

	it('rejects a portion over 5000 g and a pot denser than 9.5 kcal per gram', async () => {
		const huge = makeRecipe({ defaultGrams: 4000 })
		const dense = makeRecipe({ cookedGrams: 100, defaultGrams: 100 })
		for (const recipe of [huge, dense]) {
			const { service, logEntries } = makeService({
				findActive: vi.fn().mockResolvedValue(recipe),
				markUsed: vi.fn(),
			})
			await expect(service.logPortion(USER_ID, RECIPE_ID, 1.5)).rejects.toMatchObject({
				status: 422,
			})
			expect(logEntries).not.toHaveBeenCalled()
		}
	})
})

describe('RecipesService.get', () => {
	it('counts half, one and one and a half portions without water ingredients', async () => {
		const { service } = makeService({ findActive: vi.fn().mockResolvedValue(makeRecipe()) })

		const detail = await service.get(USER_ID, RECIPE_ID)

		expect(detail.cookedGrams).toBe(1000)
		expect(detail.kcal).toBe(400)
		expect(detail.portions.map(({ share, grams, kcal }) => [share, grams, kcal])).toEqual([
			[0.5, 200, 200],
			[1, 400, 400],
			[1.5, 600, 600],
		])
		expect(detail.ingredients).toHaveLength(2)
	})

	it("answers not found for another user's recipe", async () => {
		const { service } = makeService({ findActive: vi.fn().mockResolvedValue(null) })

		await expect(service.get('other', RECIPE_ID)).rejects.toMatchObject({ status: 404 })
	})
})
