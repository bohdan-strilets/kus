import type { MyFood } from '../../generated/prisma/client'
import { describe, expect, it, vi } from 'vitest'

import type { RelevantFoods } from '../memory/memory.service'
import type { MyFoodsService } from '../memory/my-foods.service'
import { ChatFoodRemovalsService } from './chat-food-removals.service'
import type { ChatRepository } from './chat.repository'

const food = (id: string, name: string): MyFood => ({ id, name }) as MyFood

const createService = ({
	previousId,
	pending = [],
	deleted = [],
}: {
	previousId: string | null
	pending?: MyFood[]
	deleted?: MyFood[]
}) => {
	const findPendingRemovals = vi.fn().mockResolvedValue(pending)
	const service = new ChatFoodRemovalsService(
		{
			findPreviousUserMessageId: vi.fn().mockResolvedValue(previousId),
		} as unknown as ChatRepository,
		{
			findPendingRemovals,
			findRecentlyDeleted: vi.fn().mockResolvedValue(deleted),
		} as unknown as MyFoodsService,
	)
	return { service, findPendingRemovals }
}

const params = (memory: RelevantFoods) => ({
	userId: 'u1',
	messageId: 'msg-2',
	now: new Date('2026-11-11T12:00:00Z'),
	localDate: new Date('2026-11-11T00:00:00Z'),
	timezone: 'Europe/Warsaw',
	memory,
})

describe('ChatFoodRemovalsService.load', () => {
	it('gives the foods to remove the next free m-refs and adds them to the turn', async () => {
		const passive = food('f1', 'Сир')
		const asked = food('f2', 'Батончик')
		const memory: RelevantFoods = { context: [], byRef: new Map([['m1', passive]]) }
		const { service, findPendingRemovals } = createService({
			previousId: 'msg-1',
			pending: [asked],
		})

		const result = await service.load(params(memory))

		expect(findPendingRemovals).toHaveBeenCalledWith(
			expect.objectContaining({ userId: 'u1', previousMessageId: 'msg-1' }),
		)
		expect(result.pending).toEqual([{ ref: 'm2', name: 'Батончик' }])
		expect(memory.byRef.get('m2')).toBe(asked)
		expect(result.refs.previousUserMessageId).toBe('msg-1')
	})

	it('keeps the passive ref of a food the message names again', async () => {
		const asked = food('f2', 'Батончик')
		const memory: RelevantFoods = { context: [], byRef: new Map([['m1', asked]]) }
		const { service } = createService({ previousId: 'msg-1', pending: [asked] })

		const result = await service.load(params(memory))

		expect(result.pending).toEqual([{ ref: 'm1', name: 'Батончик' }])
		expect(memory.byRef.size).toBe(1)
	})

	it('has nothing to remove without an earlier message, and numbers the forgotten foods g1…', async () => {
		const memory: RelevantFoods = { context: [], byRef: new Map() }
		const { service, findPendingRemovals } = createService({
			previousId: null,
			deleted: [food('f3', 'Скир'), food('f4', 'Мюслі')],
		})

		const result = await service.load(params(memory))

		expect(findPendingRemovals).not.toHaveBeenCalled()
		expect(result.pending).toEqual([])
		expect(result.forgotten).toEqual([
			{ ref: 'g1', name: 'Скир' },
			{ ref: 'g2', name: 'Мюслі' },
		])
	})
})
