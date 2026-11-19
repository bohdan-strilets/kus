import type { RecipeDraft } from '@kus/shared'
import { describe, expect, it, vi } from 'vitest'

import type { Prisma } from '../../generated/prisma/client'
import type { EntriesRepository, EntryWithMealType } from './entries.repository'
import { PotEntriesService } from './pot-entries.service'

const TX = {} as Prisma.TransactionClient
const USER_ID = 'user-1'
const POT_ID = 'pot-1'

/** 910 g of ingredients and 890 kcal; with 4000 ml of water 4910 g, ≈ 18.1 kcal/100 g. */
const draft = (waterMl: number): RecipeDraft => ({
	ingredients: [
		{ name: 'Філе', grams: 410, kcal: 450, protein: 90, fat: 6, carbs: 0, fiber: null },
		{ name: 'Картопля', grams: 500, kcal: 440, protein: 10, fat: 1, carbs: 100, fiber: null },
	],
	waterMl,
	cookedGrams: null,
	servings: null,
})

const portion = (overrides: Partial<EntryWithMealType> = {}): EntryWithMealType =>
	({
		id: 'entry-1',
		userId: USER_ID,
		potId: POT_ID,
		grams: 500,
		kcal: 114,
		proteinG: 10,
		fatG: 1,
		carbsG: 10,
		recipeId: null,
		sourceMessageId: 'message-1',
		meal: { type: 'LUNCH', localDate: new Date('2026-11-19T00:00:00Z') },
		...overrides,
	}) as EntryWithMealType

const setup = () => {
	const updateEntry = vi.fn().mockResolvedValue(true)
	const createCorrections = vi.fn().mockResolvedValue(undefined)
	const findPortions = vi.fn().mockResolvedValue([])
	const linkRecipe = vi.fn().mockResolvedValue(2)
	const service = new PotEntriesService(
		{ updateEntry, createCorrections } as unknown as EntriesRepository,
		{ findPortions, linkRecipe },
	)
	return { service, updateEntry, createCorrections, findPortions, linkRecipe }
}

describe('PotEntriesService.findPortions', () => {
	it('looks for the pot of the user, 3 days before the entry on', async () => {
		const { service, findPortions } = setup()

		await service.findPortions(portion(), TX)

		expect(findPortions).toHaveBeenCalledWith(
			{ userId: USER_ID, potId: POT_ID, from: new Date('2026-11-16T00:00:00Z') },
			TX,
		)
	})

	it('finds nothing for an entry that is not a portion of a pot', async () => {
		const { service, findPortions } = setup()

		expect(await service.findPortions(portion({ potId: null }), TX)).toEqual([])
		expect(findPortions).not.toHaveBeenCalled()
	})
})

describe('PotEntriesService.linkRecipe', () => {
	it('links the portions of the pot, the replaced recipe`s included', async () => {
		const { service, linkRecipe } = setup()

		await service.linkRecipe(
			{ entry: portion(), recipeId: 'recipe-2', replacedRecipeId: 'recipe-1' },
			TX,
		)

		expect(linkRecipe).toHaveBeenCalledWith(
			{
				userId: USER_ID,
				potId: POT_ID,
				from: new Date('2026-11-16T00:00:00Z'),
				recipeId: 'recipe-2',
				replacedRecipeId: 'recipe-1',
			},
			TX,
		)
	})

	it('links nothing for an entry that is not a portion of a pot', async () => {
		const { service, linkRecipe } = setup()

		expect(
			await service.linkRecipe(
				{ entry: portion({ potId: null }), recipeId: 'recipe-2', replacedRecipeId: null },
				TX,
			),
		).toBe(0)
		expect(linkRecipe).not.toHaveBeenCalled()
	})
})

describe('PotEntriesService.recount', () => {
	it('gives every portion its own grams at the new density, a draft and a Correction', async () => {
		const { service, updateEntry, createCorrections } = setup()
		const portions = [
			portion({ id: 'a', grams: 500, sourceMessageId: 'message-1' }),
			portion({ id: 'b', grams: 250, sourceMessageId: 'message-2', recipeId: 'recipe-1' }),
		]

		const result = await service.recount(
			{ portions, draft: draft(4000), messageId: 'message-3' },
			TX,
		)

		const [first, second] = updateEntry.mock.calls.map(
			([params]) => (params as { data: { kcal: number } }).data,
		)
		expect(first).toMatchObject({ kcal: 90.6, isEdited: true, recipeDraft: draft(4000) })
		expect(second?.kcal).toBeCloseTo(45.3, 1)
		expect(createCorrections).toHaveBeenCalledOnce()
		const [corrections] = createCorrections.mock.calls[0] as [
			{
				foodEntryId: string
				messageId: string
				before: { kcal: number }
				after: { kcal: number }
			}[],
		]
		expect(corrections.map(({ foodEntryId }) => foodEntryId)).toEqual(['a', 'b'])
		expect(corrections[0]).toMatchObject({ messageId: 'message-3', before: { kcal: 114 } })
		expect(corrections[0]?.after.kcal).toBe(90.6)
		expect(result.sourceMessageIds.sort()).toEqual(['message-1', 'message-2'])
		expect(result.recipeIds).toEqual(['recipe-1'])
	})

	it('writes no Correction for a portion whose numbers did not change, but keeps its draft', async () => {
		const { service, updateEntry, createCorrections } = setup()
		const same = portion({ kcal: 90.6, proteinG: 10.2, fatG: 0.7, carbsG: 10.2 })

		await service.recount({ portions: [same], draft: draft(4000) }, TX)

		expect(updateEntry).toHaveBeenCalledOnce()
		expect(createCorrections).toHaveBeenCalledWith([], TX)
	})

	it('skips a portion deleted meanwhile without a Correction for it', async () => {
		const { service, updateEntry, createCorrections } = setup()
		updateEntry.mockResolvedValueOnce(false)

		const result = await service.recount({ portions: [portion()], draft: draft(4000) }, TX)

		expect(createCorrections).toHaveBeenCalledWith([], TX)
		expect(result.sourceMessageIds).toEqual([])
	})
})
