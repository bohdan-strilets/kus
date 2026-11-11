import { describe, expect, it, vi } from 'vitest'
import { FOOD_REMOVAL_PROPOSAL_TTL_MS } from '@kus/shared'

import type { Prisma } from '../../generated/prisma/client'
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
		)

		await service.saveFromChat({ userId: USER_ID, data: DATA, sourceMessageId: 'm1' }, TX)

		expect(createFoodIfFree).toHaveBeenCalledWith(
			{ userId: USER_ID, data: DATA, sourceMessageId: 'm1' },
			TX,
		)
	})
})

const makeService = (repository: Partial<Record<keyof MemoryRepository, unknown>>) =>
	new MyFoodsService({} as never, repository as unknown as MemoryRepository, {} as never)

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
