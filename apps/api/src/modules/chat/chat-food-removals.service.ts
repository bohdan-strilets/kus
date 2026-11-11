import { Injectable } from '@nestjs/common'
import type { FoodRefContext } from '@kus/shared'

import { getZonedMoment } from '../../common/time'
import type { MyFood } from '../../generated/prisma/client'
import type { RelevantFoods } from '../memory/memory.service'
import { MyFoodsService } from '../memory/my-foods.service'
import type { FoodRemovalRefs } from './chat-turn.service'
import { ChatRepository } from './chat.repository'

const SAVED_FOOD_REF_PREFIX = 'm'
const FORGOTTEN_FOOD_REF_PREFIX = 'g'

export interface FoodRemovalContext {
	/** What the turn is checked against. */
	refs: FoodRemovalRefs
	/** What the model sees. */
	pending: FoodRefContext[]
	forgotten: FoodRefContext[]
}

/** «Foods to remove» and «Foods forgotten today»: the state forget_food and restore_food stand on. */
@Injectable()
export class ChatFoodRemovalsService {
	constructor(
		private readonly chatRepository: ChatRepository,
		private readonly myFoods: MyFoodsService,
	) {}

	/**
	 * Foods the previous reply asked to remove get an `m…` (the passive one when it has it) and join
	 * `memory.byRef`, so the turn resolves their refs like any saved food's; foods deleted since the
	 * user's local midnight get a `g…`.
	 */
	async load({
		userId,
		messageId,
		now,
		localDate,
		timezone,
		memory,
	}: {
		userId: string
		messageId: string
		now: Date
		localDate: Date
		timezone: string
		memory: RelevantFoods
	}): Promise<FoodRemovalContext> {
		const previousUserMessageId = await this.chatRepository.findPreviousUserMessageId({
			userId,
			beforeId: messageId,
		})
		const [pendingFoods, deletedFoods] = await Promise.all([
			previousUserMessageId === null
				? Promise.resolve([])
				: this.myFoods.findPendingRemovals({
						userId,
						previousMessageId: previousUserMessageId,
						now,
					}),
			this.myFoods.findRecentlyDeleted(userId, getZonedMoment(localDate, 0, timezone)),
		])
		const pendingFoodsByRef = this.issuePendingRefs(pendingFoods, memory)
		const forgottenFoodsByRef = new Map(
			deletedFoods.map((food, index) => [`${FORGOTTEN_FOOD_REF_PREFIX}${index + 1}`, food]),
		)
		return {
			refs: { pendingFoodsByRef, forgottenFoodsByRef, previousUserMessageId },
			pending: toRefContexts(pendingFoodsByRef),
			forgotten: toRefContexts(forgottenFoodsByRef),
		}
	}

	private issuePendingRefs(foods: MyFood[], memory: RelevantFoods): Map<string, MyFood> {
		const refByFoodId = new Map([...memory.byRef].map(([ref, food]) => [food.id, ref]))
		const pending = new Map<string, MyFood>()
		for (const food of foods) {
			const ref = refByFoodId.get(food.id) ?? `${SAVED_FOOD_REF_PREFIX}${memory.byRef.size + 1}`
			memory.byRef.set(ref, food)
			pending.set(ref, food)
		}
		return pending
	}
}

const toRefContexts = (foods: ReadonlyMap<string, MyFood>): FoodRefContext[] =>
	[...foods].map(([ref, food]) => ({ ref, name: food.name }))
