import { Injectable } from '@nestjs/common'
import type { HistoryMarkerFields } from '@kus/shared'

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
