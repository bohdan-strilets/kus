import { describe, expect, it, vi } from 'vitest'

import { RECIPE_SCAN_LIMIT } from './recipes.constants'
import { RecipesContextService } from './recipes-context.service'
import type {
	MatchableRecipe,
	RecipesRepository,
	RecipeWithIngredients,
} from './recipes.repository'

const USER_ID = 'u1'

const matchable = (id: string, name: string, aliases: string[] = []): MatchableRecipe => ({
	id,
	name,
	aliases,
	usageCount: 0,
	lastUsedAt: null,
})

/** A 1000 g pot of 1000 kcal: 100 kcal/100 g. */
const full = (id: string, name: string, defaultGrams: number | null = 350): RecipeWithIngredients =>
	({
		id,
		userId: USER_ID,
		name,
		aliases: [],
		cookedGrams: 1000,
		defaultGrams,
		usageCount: 0,
		lastUsedAt: null,
		ingredients: [
			{ name: 'Буряк', grams: 600, kcal: 600, proteinG: 0, fatG: 0, carbsG: 0 },
			{ name: 'Яловичина', grams: 400, kcal: 400, proteinG: 0, fatG: 0, carbsG: 0 },
		],
	}) as unknown as RecipeWithIngredients

const create = (rows: MatchableRecipe[], loaded: RecipeWithIngredients[] = []) => {
	const findMatchable = vi.fn(() => Promise.resolve(rows))
	const findActiveByIds = vi.fn(() => Promise.resolve(loaded))
	const findActiveForSearch = vi.fn(() => Promise.resolve(loaded))
	const service = new RecipesContextService({
		findMatchable,
		findActiveByIds,
		findActiveForSearch,
	} as unknown as RecipesRepository)
	return { service, findMatchable, findActiveByIds, findActiveForSearch }
}

describe('RecipesContextService.findRelevant', () => {
	it('returns the matching recipes with r-refs and per-100 g values counted from the ingredients', async () => {
		const { service, findMatchable, findActiveByIds } = create(
			[matchable('a', 'Борщ'), matchable('b', 'Плов')],
			[full('a', 'Борщ')],
		)

		const { context, byRef } = await service.findRelevant(USER_ID, 'з’їв борщ')

		expect(context).toEqual([{ ref: 'r1', name: 'Борщ', portionGrams: 350, kcalPer100g: 100 }])
		expect(byRef.get('r1')?.id).toBe('a')
		expect(findMatchable).toHaveBeenCalledWith({ userId: USER_ID, take: RECIPE_SCAN_LIMIT })
		expect(findActiveByIds).toHaveBeenCalledWith({ userId: USER_ID, ids: ['a'] })
	})

	it('matches an alias', async () => {
		const { service } = create([matchable('a', 'Борщ', ['борщик'])], [full('a', 'Борщ')])

		expect((await service.findRelevant(USER_ID, 'тарілка борщика')).context).toHaveLength(1)
	})

	it('has nothing and reads no more than the names when no recipe matches', async () => {
		const { service, findActiveByIds } = create([matchable('a', 'Борщ')])

		const result = await service.findRelevant(USER_ID, 'випив каву')

		expect(result.context).toEqual([])
		expect(result.byRef.size).toBe(0)
		expect(findActiveByIds).not.toHaveBeenCalled()
	})

	it('reads nothing for a message without words (a photo alone)', async () => {
		const { service, findMatchable } = create([matchable('a', 'Борщ')])

		expect((await service.findRelevant(USER_ID, '  ')).context).toEqual([])
		expect(findMatchable).not.toHaveBeenCalled()
	})

	it('lists at most five recipes, numbered r1…r5', async () => {
		const rows = Array.from({ length: 8 }, (_, index) => matchable(`id${index}`, `Суп ${index}`))
		const { service } = create(
			rows,
			rows.map(({ id, name }) => full(id, name)),
		)

		const { context } = await service.findRelevant(USER_ID, 'суп')

		expect(context.map(({ ref }) => ref)).toEqual(['r1', 'r2', 'r3', 'r4', 'r5'])
	})

	it('drops a recipe deleted between the two reads', async () => {
		const { service } = create(
			[matchable('a', 'Борщ'), matchable('b', 'Борщ зелений')],
			[full('b', 'Борщ зелений')],
		)

		const { context, byRef } = await service.findRelevant(USER_ID, 'борщ')

		expect(context.map(({ name }) => name)).toEqual(['Борщ зелений'])
		expect([...byRef.keys()]).toEqual(['r1'])
	})

	it('has no portion in the line when none is saved', async () => {
		const { service } = create([matchable('a', 'Борщ')], [full('a', 'Борщ', null)])

		expect((await service.findRelevant(USER_ID, 'борщ')).context[0]?.portionGrams).toBeNull()
	})
})

describe('RecipesContextService.findForSearch', () => {
	it('reads the recipes of the user through the repository, which keeps only active ones', async () => {
		const { service, findActiveForSearch } = create([], [full('a', 'Борщ')])

		expect(await service.findForSearch(USER_ID)).toHaveLength(1)
		expect(findActiveForSearch).toHaveBeenCalledWith({ userId: USER_ID, take: RECIPE_SCAN_LIMIT })
	})
})
