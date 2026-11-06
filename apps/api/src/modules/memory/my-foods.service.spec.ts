import { describe, expect, it, vi } from 'vitest'

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
