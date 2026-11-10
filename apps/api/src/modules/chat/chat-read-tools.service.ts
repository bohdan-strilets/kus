import { Injectable, Logger } from '@nestjs/common'
import {
	createRefIssuer,
	FIND_FOOD_HISTORY_DAYS,
	FIND_FOOD_TOOL_NAME,
	type FindFoodHistoryEntry,
	findFoodInputSchema,
	type FindFoodSavedFood,
	HISTORY_FOOD_REF_PREFIX,
	runFindFood,
	SAVED_FOOD_REF_PREFIX,
} from '@kus/shared'

import { addDays, formatDbDate } from '../../common/time'
import type { MyFood } from '../../generated/prisma/client'
import { AiUnavailableException } from '../ai/ai.exceptions'
import type {
	ReadToolCall,
	ReadToolContext,
	ReadToolExecutor,
	ReadToolResult,
} from '../ai/read-tool-executor'
import { EntriesService, type RecentEntryName } from '../entries/entries.service'
import { MemoryService, type RelevantFoods } from '../memory/memory.service'

/** Told to the model as a tool result: it can fix its arguments within the same turn. */
const INVALID_ARGUMENTS_RESULT =
	'error: invalid arguments — query is 1–60 characters of the food name'

const toSavedFood = (food: MyFood): FindFoodSavedFood => ({
	key: food.id,
	name: food.name,
	aliases: food.aliases,
	per100g: {
		kcal: food.kcalPer100g,
		protein: food.proteinPer100g,
		fat: food.fatPer100g,
		carbs: food.carbsPer100g,
	},
	pieceGrams: food.pieceGrams,
	defaultGrams: food.defaultGrams,
	category: food.category,
	usageCount: food.usageCount,
	lastUsedAt: food.lastUsedAt,
})

const toHistoryEntry = ({ entry, count }: RecentEntryName): FindFoodHistoryEntry => ({
	key: entry.id,
	date: formatDbDate(entry.meal.localDate),
	mealType: entry.meal.type,
	name: entry.name,
	grams: entry.grams,
	kcal: entry.kcal,
	source: entry.source,
	count,
})

/** What one turn's executor extends: the id maps the decision is saved with. */
export interface ReadToolTurnRefs {
	/** The turn's saved foods by ref (`m…`); new refs are added to it. */
	memory: Pick<RelevantFoods, 'byRef'>
	/** The turn's earlier entries by ref (`y…`/`h…`) → entry id; new refs are added to it. */
	copyRefIds: Map<string, string>
}

/**
 * Answers find_food for one chat turn. The user and the day come from the turn's context, never from
 * the model's arguments; saved foods and entries are read through their services, which filter by
 * userId. Refs it hands out are added to the turn's own maps, so the same refs resolve when the
 * decision is saved (a ref is only a pointer: the backend reads the food or entry again by id).
 */
@Injectable()
export class ChatReadToolsService {
	private readonly logger = new Logger(ChatReadToolsService.name)

	constructor(
		private readonly memoryService: MemoryService,
		private readonly entriesService: EntriesService,
	) {}

	createExecutor(turn: ReadToolTurnRefs): ReadToolExecutor {
		// one read of each source per turn, however many times the model asks
		const sources = new Map<string, Promise<unknown>>()
		const once = <T>(key: string, load: () => Promise<T>): Promise<T> => {
			const known = sources.get(key)
			if (known) return known as Promise<T>
			const loaded = load()
			sources.set(key, loaded)
			return loaded
		}
		return {
			execute: (call, context) => this.findFood(call, context, turn, once),
		}
	}

	private async findFood(
		call: ReadToolCall,
		{ userId, localDate }: ReadToolContext,
		turn: ReadToolTurnRefs,
		once: <T>(key: string, load: () => Promise<T>) => Promise<T>,
	): Promise<ReadToolResult> {
		if (call.name !== FIND_FOOD_TOOL_NAME) {
			this.logger.warn(`Unknown read tool user=${userId}`)
			throw new AiUnavailableException()
		}
		const input = this.parseInput(call.arguments)
		if (input === null) return { text: INVALID_ARGUMENTS_RESULT }

		const [foods, recent] = await Promise.all([
			input.scope === 'history' ? [] : once('saved', () => this.memoryService.searchFoods(userId)),
			input.scope === 'saved'
				? []
				: once('history', () =>
						this.entriesService.findRecentEntryNames(userId, {
							from: addDays(localDate, -FIND_FOOD_HISTORY_DAYS),
							to: addDays(localDate, -1),
						}),
					),
		])
		// from here on synchronous: parallel calls never see a half-extended map
		const foodsByKey = new Map(foods.map((food) => [food.id, food]))
		const refs = {
			saved: createRefIssuer(
				SAVED_FOOD_REF_PREFIX,
				[...turn.memory.byRef].map(([ref, food]) => [ref, food.id] as const),
			),
			history: createRefIssuer(HISTORY_FOOD_REF_PREFIX, turn.copyRefIds),
		}
		const result = runFindFood({
			input,
			data: { saved: foods.map(toSavedFood), history: recent.map(toHistoryEntry) },
			refs,
		})
		for (const [ref, key] of refs.saved.getIssued()) {
			const food = foodsByKey.get(key)
			if (food) turn.memory.byRef.set(ref, food)
		}
		for (const [ref, key] of refs.history.getIssued()) turn.copyRefIds.set(ref, key)
		// metadata only: never the query or the names (CLAUDE.md §10.1)
		this.logger.log(`find_food user=${userId} scope=${input.scope} found=${result.foundCount}`)
		return { text: result.text, refsPatch: result.refsPatch }
	}

	private parseInput(raw: string) {
		try {
			const parsed = findFoodInputSchema.safeParse(JSON.parse(raw))
			return parsed.success ? parsed.data : null
		} catch {
			// not JSON: the model gets «invalid arguments» and may send them again
			return null
		}
	}
}
