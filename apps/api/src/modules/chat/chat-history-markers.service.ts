import { Injectable } from '@nestjs/common'
import type { HistoryFoodAction, HistoryMarkerFields } from '@kus/shared'

import { AiService } from '../ai/ai.service'
import { FactsService } from '../facts/facts.service'
import { MeasurementsService } from '../measurements/measurements.service'
import { MemoryService } from '../memory/memory.service'
import type { WorkoutRefIds } from '../workouts/workout-refs'
import { WorkoutsTurnService } from '../workouts/workouts-turn.service'
import { buildHistoryMarkers } from './history-markers'

export interface HistoryMarkersParams {
	userId: string
	/** The user messages of the history. */
	messageIds: string[]
	workoutRefIds: WorkoutRefIds
	/** Fact id → `f1…` of this request. */
	factRefById: ReadonlyMap<string, string>
	/** Saved food id → `m1…` of this request. */
	foodRefById: ReadonlyMap<string, string>
}

/** What Kusik did to the saved foods answering a user message. */
export interface HistoryFoodActions {
	forgottenFoods: HistoryFoodAction[]
	restoredFoods: HistoryFoodAction[]
}

const invert = (refIds: ReadonlyMap<string, string>): [string, string][] =>
	[...refIds].map(([ref, id]) => [id, ref])

/**
 * What the user's earlier turns did besides logging food (a workout, a weight, facts, saved
 * foods): the markers the model reads in front of each of them. Other modules answer through their
 * services, one batched query each.
 */
@Injectable()
export class ChatHistoryMarkersService {
	constructor(
		private readonly workoutsTurn: WorkoutsTurnService,
		private readonly measurementsService: MeasurementsService,
		private readonly factsService: FactsService,
		private readonly aiService: AiService,
		private readonly memoryService: MemoryService,
	) {}

	/**
	 * User message id → digests of what Kusik read answering it (the `reads` of the reply's marker).
	 * Through the AI module's service, scoped to the user.
	 */
	getReadDigests(userId: string, messageIds: string[]): Promise<ReadonlyMap<string, string[]>> {
		return this.aiService.findReadDigests(userId, messageIds)
	}

	/**
	 * User message id → the saved foods Kusik removed and brought back answering it (forget_food,
	 * restore_food): the name, the `g…` of this request while the food can still be brought back,
	 * and whether a removed one is saved again.
	 */
	async getFoodActions({
		userId,
		messageIds,
		forgottenRefById,
	}: {
		userId: string
		messageIds: string[]
		/** Food id → `g1…` of «Foods forgotten today» in this request. */
		forgottenRefById: ReadonlyMap<string, string>
	}): Promise<Map<string, HistoryFoodActions>> {
		const actions = new Map<string, HistoryFoodActions>()
		const byMessage = await this.aiService.findFoodActions(userId, messageIds)
		if (byMessage.size === 0) return actions
		const ids = [...byMessage.values()].flatMap(({ forgotten, restored }) => [
			...forgotten,
			...restored,
		])
		const foods = new Map(
			(await this.memoryService.findForHistory(userId, ids)).map((food) => [food.id, food]),
		)
		for (const [messageId, { forgotten, restored }] of byMessage) {
			const forgottenFoods = forgotten.flatMap((id): HistoryFoodAction[] => {
				const food = foods.get(id)
				if (!food) return []
				return [
					{
						name: food.name,
						ref: forgottenRefById.get(id) ?? null,
						...(food.deletedAt === null ? { isRestoredLater: true } : {}),
					},
				]
			})
			const restoredFoods = restored.flatMap((id): HistoryFoodAction[] => {
				const food = foods.get(id)
				return food ? [{ name: food.name, ref: null }] : []
			})
			if (forgottenFoods.length > 0 || restoredFoods.length > 0) {
				actions.set(messageId, { forgottenFoods, restoredFoods })
			}
		}
		return actions
	}

	/** Message id → its markers; a message with nothing to mark is absent. */
	async getMarkers({
		userId,
		messageIds,
		workoutRefIds,
		factRefById,
		foodRefById,
	}: HistoryMarkersParams): Promise<Map<string, HistoryMarkerFields>> {
		const markers = new Map<string, HistoryMarkerFields>()
		if (messageIds.length === 0) return markers
		const [workouts, measurements, facts, forgottenCountByMessageId, savedFoods] =
			await Promise.all([
				this.workoutsTurn.findStartedByMessages(userId, messageIds),
				this.measurementsService.findByMessageIds({ userId, messageIds }),
				this.factsService.findForHistory(userId, messageIds),
				this.aiService.countForgottenFacts(userId, messageIds),
				this.memoryService.findSavedByMessages(userId, messageIds),
			])
		const sources = {
			workouts,
			workoutRefById: new Map([
				...invert(workoutRefIds.workouts),
				...invert(workoutRefIds.deletedWorkouts),
			]),
			measurements,
			facts,
			factRefById,
			forgottenCountByMessageId,
			savedFoods,
			foodRefById,
		}
		for (const messageId of messageIds) {
			const own = buildHistoryMarkers(messageId, sources)
			if (Object.keys(own).length > 0) markers.set(messageId, own)
		}
		return markers
	}
}
