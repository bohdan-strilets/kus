import { Injectable } from '@nestjs/common'
import {
	type DailyGoal,
	type DayTotals,
	type FoodParseContext,
	type GoalContext,
	HISTORY_MAX_MESSAGES,
	MAX_CONTEXT_OPEN_CLARIFICATIONS,
	type MeasurementsContext,
	type MemoryFoodContext,
} from '@kus/shared'

import { formatDbDate, formatLocalTime } from '../../common/time'
import { MeasurementKind } from '../../generated/prisma/client'
import { type DaySummary, EntriesService } from '../entries/entries.service'
import { GoalsService } from '../goals/goals.service'
import { MeasurementsService } from '../measurements/measurements.service'
import { ProfileService } from '../profile/profile.service'
import { ChatRepository, type MessageWithAttachments } from './chat.repository'
import { ClarificationsRepository } from './clarifications.repository'
import { buildEditContext, type EditRefIds } from './edit-context'
import { toHistoryTurns } from './history-turns'

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

/** Message id → ids of the entries it logged; built from the day already loaded, no extra query. */
const groupEntryIdsBySourceMessage = (
	entries: { id: string; sourceMessageId: string | null }[],
): Map<string, string[]> => {
	const grouped = new Map<string, string[]>()
	for (const { id, sourceMessageId } of entries) {
		if (sourceMessageId === null) continue
		grouped.set(sourceMessageId, [...(grouped.get(sourceMessageId) ?? []), id])
	}
	return grouped
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
		const { refIds, refByEntryId, ...edit } = buildEditContext({
			active: editable.active,
			deleted: editable.deleted,
			clarifications,
		})
		// all the day's entries, not only the windowed ones: a turn whose entries lost their refs
		// must still read as logged
		const entryIdsBySourceMessageId = groupEntryIdsBySourceMessage(editable.sourceMessages)
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
				history: history
					.reverse()
					.flatMap((turn) => toHistoryTurns(turn, refByEntryId, entryIdsBySourceMessageId)),
			},
			refIds,
		}
	}
}
