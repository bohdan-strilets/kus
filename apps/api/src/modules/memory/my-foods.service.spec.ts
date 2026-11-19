import { describe, expect, it, vi } from 'vitest'
import { FOOD_REMOVAL_PROPOSAL_TTL_MS } from '@kus/shared'

import type { Prisma } from '../../generated/prisma/client'
import { EntriesService } from '../entries/entries.service'
import type { EntriesRepository } from '../entries/entries.repository'
import type { MemoryRepository } from './memory.repository'
import { MyFoodsService } from './my-foods.service'
import type { NewMyFood } from './my-foods.utils'

const USER_ID = 'u1'
const TX = {} as Prisma.TransactionClient

const DATA: NewMyFood = {
	name: 'Скир',
	nameNormalized: 'скир',
	kcalPer100g: 63,
	proteinPer100g: 11,
	fatPer100g: 0.2,
	carbsPer100g: 4,
	fiberPer100g: null,
	pieceGrams: null,
	defaultGrams: 150,
	category: 'plate',
	source: 'MANUAL',
}

describe('MyFoodsService.saveFromChat', () => {
	it('remembers the message that saved the food', async () => {
		const createFoodIfFree = vi.fn().mockResolvedValue({ id: 'food-1' })
		const service = new MyFoodsService(
			{} as never,
			{ createFoodIfFree } as unknown as MemoryRepository,
			{} as never,
			{} as never,
		)

		await service.saveFromChat({ userId: USER_ID, data: DATA, sourceMessageId: 'm1' }, TX)

		expect(createFoodIfFree).toHaveBeenCalledWith(
			{ userId: USER_ID, data: DATA, sourceMessageId: 'm1' },
			TX,
		)
	})
})

const makeService = (repository: Partial<Record<keyof MemoryRepository, unknown>>) =>
	new MyFoodsService(
		{} as never,
		repository as unknown as MemoryRepository,
		{} as never,
		{} as never,
	)

describe('MyFoodsService.forgetFromChat', () => {
	it('deletes only through the previous message and the time window', async () => {
		const deleteProposed = vi.fn().mockResolvedValue(true)
		const service = makeService({ deleteProposed })
		const before = Date.now()

		const result = await service.forgetFromChat(
			{ userId: USER_ID, id: 'food-1', previousMessageId: 'msg-1' },
			TX,
		)

		expect(result).toBe(true)
		const [args, tx] = deleteProposed.mock.calls[0] as [
			{ messageId: string; since: Date; deletedAt: Date },
			unknown,
		]
		expect(tx).toBe(TX)
		expect(args.messageId).toBe('msg-1')
		expect(args.deletedAt.getTime() - args.since.getTime()).toBe(FOOD_REMOVAL_PROPOSAL_TTL_MS)
		expect(args.deletedAt.getTime()).toBeGreaterThanOrEqual(before)
	})

	it('deletes nothing when the repository finds no matching proposal', async () => {
		const service = makeService({ deleteProposed: vi.fn().mockResolvedValue(false) })

		expect(
			await service.forgetFromChat({ userId: USER_ID, id: 'f', previousMessageId: 'x' }, TX),
		).toBe(false)
	})
})

describe('MyFoodsService.proposeRemovalFromChat', () => {
	it('stores the question message on the foods', async () => {
		const setRemovalProposed = vi.fn().mockResolvedValue(undefined)
		const service = makeService({ setRemovalProposed })

		await service.proposeRemovalFromChat({ userId: USER_ID, ids: ['a', 'b'], messageId: 'm9' }, TX)

		expect(setRemovalProposed).toHaveBeenCalledWith(
			{ userId: USER_ID, ids: ['a', 'b'], messageId: 'm9' },
			TX,
		)
	})
})

describe('MyFoodsService.restoreFromChat', () => {
	const deleted = { id: 'f1', nameNormalized: 'скир', deletedAt: new Date() }

	it('brings a deleted food back', async () => {
		const setDeletedAt = vi.fn().mockResolvedValue(true)
		const service = makeService({
			findFood: vi.fn().mockResolvedValue(deleted),
			findActiveFoodByName: vi.fn().mockResolvedValue(null),
			setDeletedAt,
		})

		expect(await service.restoreFromChat({ userId: USER_ID, id: 'f1' }, TX)).toBe('restored')
		expect(setDeletedAt).toHaveBeenCalledWith({ userId: USER_ID, id: 'f1', deletedAt: null }, TX)
	})

	it('leaves it deleted when another food holds the name', async () => {
		const setDeletedAt = vi.fn()
		const service = makeService({
			findFood: vi.fn().mockResolvedValue(deleted),
			findActiveFoodByName: vi.fn().mockResolvedValue({ id: 'other' }),
			setDeletedAt,
		})

		expect(await service.restoreFromChat({ userId: USER_ID, id: 'f1' }, TX)).toBe('name_taken')
		expect(setDeletedAt).not.toHaveBeenCalled()
	})

	it("reports a food that is not the user's as gone", async () => {
		const service = makeService({ findFood: vi.fn().mockResolvedValue(null) })

		expect(await service.restoreFromChat({ userId: USER_ID, id: 'f1' }, TX)).toBe('gone')
	})
})

describe('MyFoodsService.rememberEntries', () => {
	const createRow = (overrides: Record<string, unknown>) => ({
		id: 'e1',
		userId: USER_ID,
		name: 'Скир',
		grams: 150,
		quantity: null,
		kcal: 95,
		proteinG: 16,
		fatG: 0.3,
		carbsG: 6,
		fiberG: null,
		category: 'plate',
		source: 'MEMORY',
		isUndetailed: false,
		myFoodId: null,
		recipeId: null,
		potId: null,
		myFood: null,
		recipe: null,
		...overrides,
	})

	it('skips an entry linked to an active food as exists, drops the rest without a trace', async () => {
		const rows = [
			createRow({ id: 'linked', myFoodId: 'f1', myFood: { deletedAt: null } }),
			createRow({ id: 'rest', name: 'Інше', isUndetailed: true }),
			createRow({ id: 'portion', name: 'Пончик', recipeId: 'r1', recipe: { deletedAt: null } }),
			createRow({
				id: 'both',
				name: 'Суп',
				myFoodId: 'f1',
				myFood: { deletedAt: null },
				recipeId: 'r1',
				recipe: { deletedAt: null },
			}),
		]
		const entriesService = new EntriesService({
			findVisibleEntries: vi.fn().mockResolvedValue(rows),
		} as unknown as EntriesRepository)
		const findActiveFoodByName = vi.fn().mockResolvedValue({ id: 'f1' })
		const prisma = { $transaction: (fn: (tx: unknown) => unknown) => fn(TX) }
		const service = new MyFoodsService(
			prisma as never,
			{ findActiveFoodByName } as unknown as MemoryRepository,
			entriesService,
			{} as never,
		)

		const response = await service.rememberEntries(USER_ID, ['linked', 'rest', 'portion', 'both'])

		expect(response).toEqual({
			created: [],
			createdRecipes: [],
			skipped: [{ entryId: 'linked', reason: 'exists' }],
		})
	})
	it('saves a portion of a pot as a recipe, not as a food', async () => {
		const rows = [
			createRow({ id: 'pot-portion', name: 'Суп курячий', potId: 'pot-1', category: 'soup' }),
			createRow({ id: 'plain', name: 'Скир' }),
		]
		const entriesService = new EntriesService({
			findVisibleEntries: vi.fn().mockResolvedValue(rows),
		} as unknown as EntriesRepository)
		const saveFromEntry = vi
			.fn()
			.mockResolvedValue({ id: 'recipe-1', name: 'Суп курячий', replaced: false })
		const createFood = vi
			.fn()
			.mockResolvedValue({ id: 'food-1', ...DATA, brand: null, aliases: [], updatedAt: new Date() })
		const linkMyFood = vi.spyOn(entriesService, 'linkMyFood').mockResolvedValue(undefined)
		const prisma = { $transaction: (fn: (tx: unknown) => unknown) => fn(TX) }
		const service = new MyFoodsService(
			prisma as never,
			{
				findActiveFoodByName: vi.fn().mockResolvedValue(null),
				createFood,
			} as unknown as MemoryRepository,
			entriesService,
			{ saveFromEntry } as never,
		)

		const response = await service.rememberEntries(USER_ID, ['pot-portion', 'plain'])

		expect(saveFromEntry).toHaveBeenCalledOnce()
		expect(saveFromEntry).toHaveBeenCalledWith(
			{
				userId: USER_ID,
				entryId: 'pot-portion',
				identity: { name: 'Суп курячий', aliases: [], category: 'soup' },
				messageId: null,
			},
			TX,
		)
		expect(createFood).toHaveBeenCalledOnce()
		expect(linkMyFood).not.toHaveBeenCalledWith(
			expect.objectContaining({ entryId: 'pot-portion' }),
			TX,
		)
		expect(response.createdRecipes).toEqual([
			{ id: 'recipe-1', name: 'Суп курячий', replaced: false },
		])
		expect(response.created).toHaveLength(1)
	})

	it('leaves a pot portion whose recipe is active out, like any portion of a recipe', async () => {
		const rows = [
			createRow({
				id: 'saved-pot',
				potId: 'pot-1',
				recipeId: 'r1',
				recipe: { deletedAt: null },
			}),
		]
		const entriesService = new EntriesService({
			findVisibleEntries: vi.fn().mockResolvedValue(rows),
		} as unknown as EntriesRepository)
		const saveFromEntry = vi.fn()
		const prisma = { $transaction: (fn: (tx: unknown) => unknown) => fn(TX) }
		const service = new MyFoodsService(
			prisma as never,
			{} as unknown as MemoryRepository,
			entriesService,
			{ saveFromEntry } as never,
		)

		const response = await service.rememberEntries(USER_ID, ['saved-pot'])

		expect(saveFromEntry).not.toHaveBeenCalled()
		expect(response).toEqual({ created: [], createdRecipes: [], skipped: [] })
	})
})
