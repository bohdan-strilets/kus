import { Injectable, Logger } from '@nestjs/common'
import {
	getRejectedFactNotice,
	FACTS_LIMIT_NOTICE,
	FOOD_RESTORE_GONE_NOTICE,
	FOOD_RESTORE_NAME_TAKEN_NOTICE,
	type MemoryActions,
	type MemoryNotice,
	type SaveFoodInput,
} from '@kus/shared'

import type { FoodEntry, MyFood, Prisma } from '../../generated/prisma/client'
import { EntriesService } from '../entries/entries.service'
import { FactsService } from '../facts/facts.service'
import { MyFoodsService } from '../memory/my-foods.service'
import { toNewChatFood } from '../memory/my-foods.utils'

/** A food the turn saved or updated; only live in the response of the turn. */
export interface SavedFoodRef {
	id: string
	name: string
}

export interface MemoryTurnParams {
	userId: string
	/** The user's message: the source of the facts this turn proposes. */
	messageId: string
	memory: MemoryActions
	/** `m1…` → the user's own saved foods of this request. */
	foodsByRef: ReadonlyMap<string, MyFood>
	/** `f1…` → the ids of the facts shown to the model in this request. */
	factIdByRef: ReadonlyMap<string, string>
	/** `m…` of «Foods to remove» → the food the previous reply asked about. */
	pendingFoodsByRef: ReadonlyMap<string, MyFood>
	/** `g1…` of «Foods forgotten today» → the food. */
	forgottenFoodsByRef: ReadonlyMap<string, MyFood>
	/** The user's message before this one: the only one whose question a "yes" can answer. */
	previousUserMessageId: string | null
	/** Ids of the entries this turn logged, by the index of the log_food item. */
	entryIds: readonly string[]
	hasPhoto: boolean
}

export interface MemoryTurnResult {
	savedFoods: SavedFoodRef[]
	/** Foods removed from memory by this turn (the user's "yes"). */
	forgottenFoods: SavedFoodRef[]
	/** A sentence the backend adds to (or puts instead of) the reply; null = the reply stands. */
	notice: MemoryNotice | null
}

export const NO_MEMORY_RESULT: MemoryTurnResult = {
	savedFoods: [],
	forgottenFoods: [],
	notice: null,
}

/** What the memory tools (save_food, save_fact, forget_fact, forget_food, restore_food) do inside the transaction of a chat turn. */
@Injectable()
export class ChatTurnMemoryService {
	private readonly logger = new Logger(ChatTurnMemoryService.name)

	constructor(
		private readonly myFoods: MyFoodsService,
		private readonly facts: FactsService,
		private readonly entriesService: EntriesService,
	) {}

	/** Texts and names never reach the log: counts only. */
	async apply(params: MemoryTurnParams, tx: Prisma.TransactionClient): Promise<MemoryTurnResult> {
		const { userId, memory } = params
		const forgotten = await this.forget(params, tx)
		const factNotice = await this.saveFact(params, tx)
		const savedFoods = await this.saveFoods(params, tx)
		const forgottenFoods = await this.forgetFoods(params, tx)
		await this.proposeFoodRemovals(params, tx)
		const restore = await this.restoreFoods(params, tx)
		this.logger.log(
			`Memory turn user=${userId} foods=${savedFoods.length}/${memory.foods.length} fact=${memory.fact ? 1 : 0} forgotten=${forgotten}/${memory.forgets.length} foodsRemoved=${forgottenFoods.length}/${memory.foodRemovals.length} foodsRestored=${restore.restored}/${memory.foodRestores.length}`,
		)
		return { savedFoods, forgottenFoods, notice: factNotice ?? restore.notice }
	}

	/** confirmed false: only remembers which message asked; nothing is deleted. */
	private async proposeFoodRemovals(
		{ userId, messageId, memory, foodsByRef }: MemoryTurnParams,
		tx: Prisma.TransactionClient,
	): Promise<void> {
		const asked = memory.foodRemovals.filter(({ confirmed }) => !confirmed)
		if (asked.length === 0) return
		const ids = asked.map(({ ref }) => {
			const food = foodsByRef.get(ref)
			// the parser accepts only refs of this request; a miss here is a bug
			if (!food) throw new Error('forget_food ref is not mapped')
			return food.id
		})
		await this.myFoods.proposeRemovalFromChat({ userId, ids, messageId }, tx)
	}

	/** confirmed true: the backend re-checks that the previous message asked about this very food. */
	private async forgetFoods(
		{ userId, memory, pendingFoodsByRef, previousUserMessageId }: MemoryTurnParams,
		tx: Prisma.TransactionClient,
	): Promise<SavedFoodRef[]> {
		const forgotten: SavedFoodRef[] = []
		for (const { ref, confirmed } of memory.foodRemovals) {
			if (!confirmed) continue
			const food = pendingFoodsByRef.get(ref)
			// the parser accepts only refs of this request; a miss here is a bug
			if (!food) throw new Error('forget_food ref is not pending')
			if (previousUserMessageId === null) continue
			const isForgotten = await this.myFoods.forgetFromChat(
				{ userId, id: food.id, previousMessageId: previousUserMessageId },
				tx,
			)
			if (isForgotten) forgotten.push({ id: food.id, name: food.name })
		}
		return forgotten
	}

	private async restoreFoods(
		{ userId, memory, forgottenFoodsByRef }: MemoryTurnParams,
		tx: Prisma.TransactionClient,
	): Promise<{ restored: number; notice: MemoryNotice | null }> {
		let restored = 0
		let notice: MemoryNotice | null = null
		for (const { ref } of memory.foodRestores) {
			const food = forgottenFoodsByRef.get(ref)
			// the parser accepts only refs of this request; a miss here is a bug
			if (!food) throw new Error('restore_food ref is not mapped')
			const outcome = await this.myFoods.restoreFromChat({ userId, id: food.id }, tx)
			if (outcome === 'restored') restored += 1
			if (outcome === 'name_taken') notice = FOOD_RESTORE_NAME_TAKEN_NOTICE
			if (outcome === 'gone') notice ??= FOOD_RESTORE_GONE_NOTICE
		}
		return { restored, notice }
	}

	private async forget(
		{ userId, memory, factIdByRef }: MemoryTurnParams,
		tx: Prisma.TransactionClient,
	): Promise<number> {
		let forgotten = 0
		for (const { ref } of memory.forgets) {
			const id = factIdByRef.get(ref)
			// the parser accepts only refs of this request; a miss here is a bug
			if (id === undefined) throw new Error('forget_fact ref is not mapped')
			if (await this.facts.forgetFromChat(userId, id, tx)) forgotten += 1
		}
		return forgotten
	}

	private async saveFact(
		{ userId, messageId, memory }: MemoryTurnParams,
		tx: Prisma.TransactionClient,
	): Promise<MemoryNotice | null> {
		if (!memory.fact) return null
		const result = await this.facts.saveFromChat(
			userId,
			{
				text: memory.fact.text,
				category: memory.fact.category,
				explicit: memory.fact.explicit,
				sourceMessageId: messageId,
			},
			tx,
		)
		if (result.kind === 'limit') return FACTS_LIMIT_NOTICE
		if (result.kind === 'rejected') {
			this.logger.warn(`Fact not saved user=${userId} issue=${result.issue}`)
			return getRejectedFactNotice(result.issue)
		}
		return null
	}

	private async saveFoods(
		params: MemoryTurnParams,
		tx: Prisma.TransactionClient,
	): Promise<SavedFoodRef[]> {
		const saved: SavedFoodRef[] = []
		for (const input of params.memory.foods) {
			const food = await this.saveFood(params, input, tx)
			if (food) saved.push({ id: food.id, name: food.name })
		}
		return saved
	}

	private async saveFood(
		{ userId, messageId, foodsByRef, entryIds, hasPhoto }: MemoryTurnParams,
		input: SaveFoodInput,
		tx: Prisma.TransactionClient,
	): Promise<MyFood | null> {
		const entry = await this.findItemEntry(userId, input, entryIds, tx)
		// fromItemIndex with a missing entry is a bug: never save a food without its values
		if (input.fromItemIndex !== null && !entry) throw new Error('save_food item was not logged')
		const data = toNewChatFood(input, { entry, hasPhoto })
		if (!data) return null

		const food = await this.createOrUpdate({ userId, messageId, input, data, foodsByRef }, tx)
		if (food && entry) {
			await this.entriesService.linkMyFood({ userId, entryId: entry.id, myFoodId: food.id }, tx)
		}
		return food
	}

	private async createOrUpdate(
		{
			userId,
			messageId,
			input,
			data,
			foodsByRef,
		}: {
			userId: string
			messageId: string
			input: SaveFoodInput
			data: NonNullable<ReturnType<typeof toNewChatFood>>
			foodsByRef: ReadonlyMap<string, MyFood>
		},
		tx: Prisma.TransactionClient,
	): Promise<MyFood | null> {
		if (input.updateRef === null) {
			return this.myFoods.saveFromChat({ userId, data, sourceMessageId: messageId }, tx)
		}
		const target = foodsByRef.get(input.updateRef)
		// the parser accepts only refs of this request; a miss here is a bug
		if (!target) throw new Error('save_food updateRef is not mapped')
		return this.myFoods.updateFromChat({ userId, id: target.id, data }, tx)
	}

	/** The entry this turn logged for the item `fromItemIndex` points at. */
	private async findItemEntry(
		userId: string,
		{ fromItemIndex }: SaveFoodInput,
		entryIds: readonly string[],
		tx: Prisma.TransactionClient,
	): Promise<FoodEntry | undefined> {
		if (fromItemIndex === null) return undefined
		const id = entryIds[fromItemIndex]
		if (id === undefined) return undefined
		const [entry] = await this.entriesService.findActiveEntriesByIds(userId, [id], tx)
		return entry
	}
}
