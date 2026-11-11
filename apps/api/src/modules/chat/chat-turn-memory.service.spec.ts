import {
	FOOD_REMOVE_FAILED_NOTICE,
	FOOD_RESTORE_FAILED_NOTICE,
	MAX_FOOD_REMOVALS_PER_MESSAGE,
	NO_MEMORY_ACTIONS,
	type MemoryActions,
} from '@kus/shared'
import { describe, expect, it, vi } from 'vitest'

import type { MyFood, Prisma } from '../../generated/prisma/client'
import type { AiService } from '../ai/ai.service'
import type { EntriesService } from '../entries/entries.service'
import type { FactsService } from '../facts/facts.service'
import type { MyFoodsService } from '../memory/my-foods.service'
import { ChatTurnMemoryService, type MemoryTurnParams } from './chat-turn-memory.service'

const tx = {} as Prisma.TransactionClient
const USER_ID = 'user-1'
const PREVIOUS_MESSAGE_ID = 'message-0'
const OVER_LIMIT = MAX_FOOD_REMOVALS_PER_MESSAGE + 1

const toFood = (index: number): MyFood => ({ id: `food-${index}`, name: `Food ${index}` }) as MyFood

const refOf = (index: number): string => `m${index}`

const createFoods = (count: number): Map<string, MyFood> =>
	new Map(Array.from({ length: count }, (_, index) => [refOf(index + 1), toFood(index + 1)]))

const removals = (count: number, confirmed: boolean): MemoryActions['foodRemovals'] =>
	Array.from({ length: count }, (_, index) => ({ ref: refOf(index + 1), confirmed }))

const setup = (forgetFromChat: (id: string) => boolean = () => true) => {
	const myFoods = {
		proposeRemovalFromChat: vi.fn().mockResolvedValue(undefined),
		forgetFromChat: vi.fn(({ id }: { id: string }) => Promise.resolve(forgetFromChat(id))),
		restoreFromChat: vi.fn().mockResolvedValue('restored'),
	}
	const ai = { recordFoodCallResults: vi.fn().mockResolvedValue(undefined) }
	const service = new ChatTurnMemoryService(
		myFoods as unknown as MyFoodsService,
		{} as FactsService,
		{} as EntriesService,
		ai as unknown as AiService,
	)
	const run = (overrides: Partial<MemoryTurnParams>) =>
		service.apply(
			{
				userId: USER_ID,
				messageId: 'message-1',
				memory: NO_MEMORY_ACTIONS,
				foodsByRef: new Map(),
				factIdByRef: new Map(),
				pendingFoodsByRef: new Map(),
				forgottenFoodsByRef: new Map(),
				previousUserMessageId: PREVIOUS_MESSAGE_ID,
				entryIds: [],
				hasPhoto: false,
				...overrides,
			},
			tx,
		)
	return { myFoods, run }
}

describe('ChatTurnMemoryService forget_food', () => {
	it('proposes at most the limit of foods for removal', async () => {
		const { myFoods, run } = setup()
		const foodsByRef = createFoods(OVER_LIMIT)

		await run({
			memory: { ...NO_MEMORY_ACTIONS, foodRemovals: removals(OVER_LIMIT, false) },
			foodsByRef,
		})

		expect(myFoods.proposeRemovalFromChat).toHaveBeenCalledOnce()
		const [{ ids }] = myFoods.proposeRemovalFromChat.mock.calls[0] as [{ ids: string[] }]
		expect(ids).toEqual(['food-1', 'food-2', 'food-3'])
	})

	it('removes at most the limit of confirmed foods', async () => {
		const { myFoods, run } = setup()
		const pendingFoodsByRef = createFoods(OVER_LIMIT)

		const result = await run({
			memory: { ...NO_MEMORY_ACTIONS, foodRemovals: removals(OVER_LIMIT, true) },
			pendingFoodsByRef,
		})

		expect(myFoods.forgetFromChat).toHaveBeenCalledTimes(MAX_FOOD_REMOVALS_PER_MESSAGE)
		expect(result.forgottenFoods).toHaveLength(MAX_FOOD_REMOVALS_PER_MESSAGE)
		expect(result.notice).toBeNull()
	})

	it('restores at most the limit of foods', async () => {
		const { myFoods, run } = setup()
		const forgottenFoodsByRef = createFoods(OVER_LIMIT)

		await run({
			memory: {
				...NO_MEMORY_ACTIONS,
				foodRestores: Array.from({ length: OVER_LIMIT }, (_, index) => ({ ref: refOf(index + 1) })),
			},
			forgottenFoodsByRef,
		})

		expect(myFoods.restoreFromChat).toHaveBeenCalledTimes(MAX_FOOD_REMOVALS_PER_MESSAGE)
	})

	it('refuses softly when a restore ref is unknown and restores the others', async () => {
		const { myFoods, run } = setup()

		const result = await run({
			memory: { ...NO_MEMORY_ACTIONS, foodRestores: [{ ref: 'm9' }, { ref: refOf(1) }] },
			forgottenFoodsByRef: createFoods(1),
		})

		expect(myFoods.restoreFromChat).toHaveBeenCalledOnce()
		expect(result.notice).toBe(FOOD_RESTORE_FAILED_NOTICE)
	})

	it('refuses softly when a confirmed ref is no longer pending', async () => {
		const { myFoods, run } = setup()

		const result = await run({
			memory: { ...NO_MEMORY_ACTIONS, foodRemovals: removals(1, true) },
			pendingFoodsByRef: new Map(),
		})

		expect(myFoods.forgetFromChat).not.toHaveBeenCalled()
		expect(result.forgottenFoods).toEqual([])
		expect(result.notice).toBe(FOOD_REMOVE_FAILED_NOTICE)
	})

	it('refuses softly when a proposed ref has vanished and proposes nothing', async () => {
		const { myFoods, run } = setup()

		const result = await run({
			memory: { ...NO_MEMORY_ACTIONS, foodRemovals: removals(1, false) },
			foodsByRef: new Map(),
		})

		expect(myFoods.proposeRemovalFromChat).not.toHaveBeenCalled()
		expect(result.notice).toBe(FOOD_REMOVE_FAILED_NOTICE)
	})

	it('says so when the backend did not delete the food (expired question, changed food)', async () => {
		const { run } = setup(() => false)

		const result = await run({
			memory: { ...NO_MEMORY_ACTIONS, foodRemovals: removals(1, true) },
			pendingFoodsByRef: createFoods(1),
		})

		expect(result.forgottenFoods).toEqual([])
		expect(result.notice).toBe(FOOD_REMOVE_FAILED_NOTICE)
	})

	it('keeps the foods that were removed when another one failed', async () => {
		const { run } = setup((id) => id === 'food-1')

		const result = await run({
			memory: { ...NO_MEMORY_ACTIONS, foodRemovals: removals(2, true) },
			pendingFoodsByRef: createFoods(2),
		})

		expect(result.forgottenFoods).toEqual([{ id: 'food-1', name: 'Food 1' }])
		expect(result.notice).toBe(FOOD_REMOVE_FAILED_NOTICE)
	})
})
