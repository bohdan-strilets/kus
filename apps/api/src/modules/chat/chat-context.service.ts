import { Injectable } from '@nestjs/common'
import {
	type DailyGoal,
	type DayTotals,
	type FoodParseContext,
	type GoalContext,
	HISTORY_MAX_MESSAGES,
	type HistoryTurn,
	MAX_CONTEXT_OPEN_CLARIFICATIONS,
	type MeasurementsContext,
	type MemoryFoodContext,
} from '@kus/shared'

import { formatDbDate, formatLocalTime } from '../../common/time'
import { MeasurementKind, MessageRole } from '../../generated/prisma/client'
import { type DaySummary, EntriesService } from '../entries/entries.service'
import { GoalsService } from '../goals/goals.service'
import { MeasurementsService } from '../measurements/measurements.service'
import { ProfileService } from '../profile/profile.service'
import { ChatRepository, type MessageWithAttachments } from './chat.repository'
import { ClarificationsRepository } from './clarifications.repository'
import { buildEditContext, type EditRefIds } from './edit-context'

export interface DayOverview {
	summary: DaySummary
	goal: DailyGoal | null
	totals: DayTotals
}

interface BuildContextParams {
	userId: string
	timezone: string
	message: MessageWithAttachments
	now: Date
	localDate: Date
	memory: MemoryFoodContext[]
}

const toHistoryTurn = (message: MessageWithAttachments): HistoryTurn[] => {
	const role = message.role === MessageRole.USER ? 'user' : 'assistant'
	// the photo itself is never sent again: the model sees a marker next to the words
	if (message.attachments.length > 0) {
		return [{ role, content: message.content ?? '', hasPhoto: true }]
	}
	return message.content === null ? [] : [{ role, content: message.content }]
}

const CONTEXT_WEIGHT_COUNT = 2

const toPoint = ({ value, localDate }: { value: number; localDate: Date }) => ({
	value,
	localDate: formatDbDate(localDate),
})

/** What the model gets besides the message: day so far, goal, matching saved foods, last turns. */
@Injectable()
export class ChatContextService {
	constructor(
		private readonly chatRepository: ChatRepository,
		private readonly clarificationsRepository: ClarificationsRepository,
		private readonly entriesService: EntriesService,
		private readonly goalsService: GoalsService,
		private readonly measurementsService: MeasurementsService,
		private readonly profileService: ProfileService,
	) {}

	/** Day totals vs goal; the remainder is computed here, never by the model. */
	async getDayOverview(userId: string, localDate: Date): Promise<DayOverview> {
		const [summary, goal] = await Promise.all([
			this.entriesService.getDaySummary(userId, localDate),
			this.goalsService.getGoalForDate(userId, localDate),
		])
		return {
			summary,
			goal,
			totals: {
				localDate: formatDbDate(localDate),
				totals: summary.totals,
				goalKcal: goal?.kcal ?? null,
				remainingKcal: goal ? Math.round(goal.kcal - summary.totals.kcal) : null,
			},
		}
	}

	/** The latest weights and waist to compare a new one with; the model calculates nothing. */
	private async getMeasurementsContext(
		userId: string,
		localDate: Date,
	): Promise<MeasurementsContext> {
		const [weights, waist, targetWeightKg] = await Promise.all([
			this.measurementsService.findRecent({
				userId,
				kind: MeasurementKind.WEIGHT,
				take: CONTEXT_WEIGHT_COUNT,
			}),
			this.measurementsService.findLatest({ userId, kind: MeasurementKind.WAIST }),
			this.profileService.findTargetWeightKg(userId),
		])
		return {
			today: formatDbDate(localDate),
			weights: weights.map(toPoint),
			waist: waist ? toPoint(waist) : null,
			targetWeightKg,
		}
	}

	/** The model input and the ref → id map its edit tools are checked against. */
	async buildContext({
		userId,
		timezone,
		message,
		now,
		localDate,
		memory,
	}: BuildContextParams): Promise<{ context: FoodParseContext; refIds: EditRefIds }> {
		const [{ summary, goal, totals }, history, editable, measurements] = await Promise.all([
			this.getDayOverview(userId, localDate),
			this.chatRepository.findHistory({
				userId,
				beforeId: message.id,
				limit: HISTORY_MAX_MESSAGES,
			}),
			this.entriesService.getEditableEntries(userId, localDate),
			this.getMeasurementsContext(userId, localDate),
		])
		const clarifications = await this.clarificationsRepository.findOpenClarifications({
			userId,
			entryIds: editable.active.map((entry) => entry.id),
			// a few spare: questions whose entries fell out of the context are skipped
			take: MAX_CONTEXT_OPEN_CLARIFICATIONS * 2,
		})
		const { refIds, ...edit } = buildEditContext({ ...editable, clarifications })
		const goalContext: GoalContext | null =
			goal && totals.remainingKcal !== null
				? {
						dailyKcal: goal.kcal,
						protein: goal.protein,
						fat: goal.fat,
						carbs: goal.carbs,
						remainingKcal: totals.remainingKcal,
					}
				: null

		return {
			context: {
				localTime: formatLocalTime(now, timezone),
				dayTotals: summary.totals,
				meals: summary.meals,
				...edit,
				goal: goalContext,
				measurements,
				memory,
				history: history.reverse().flatMap(toHistoryTurn),
			},
			refIds,
		}
	}
}
