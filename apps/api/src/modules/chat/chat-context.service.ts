import { Injectable } from '@nestjs/common'
import {
	type AddressForm,
	type DailyGoal,
	type DayContext,
	type FactContext,
	type DayTotals,
	type FoodParseContext,
	type GoalContext,
	ENTRY_AHEAD_MAX_DAYS,
	ENTRY_BACKDATE_MAX_DAYS,
	getLoggableDays,
	HISTORY_MAX_MESSAGES,
	MAX_CONTEXT_OPEN_CLARIFICATIONS,
	MEASUREMENT_FIX_MAX_DAYS,
	type MeasurementsContext,
	type MemoryFoodContext,
	type RecentMeasurementContext,
	shiftDate,
} from '@kus/shared'

import { addDays, formatDbDate, formatLocalTime, getZonedMoment } from '../../common/time'
import { MeasurementKind } from '../../generated/prisma/client'
import { type DaySummary, EntriesService } from '../entries/entries.service'
import { FactsService } from '../facts/facts.service'
import { GoalsService } from '../goals/goals.service'
import { MeasurementsService } from '../measurements/measurements.service'
import { ProfileService } from '../profile/profile.service'
import { type WorkoutRefIds, WorkoutsTurnService } from '../workouts/workouts-turn.service'
import { ChatRepository, type MessageWithAttachments } from './chat.repository'
import { ChatEarlierService } from './chat-earlier.service'
import { ClarificationsRepository } from './clarifications.repository'
import { buildDaysContext } from './days-context'
import { buildEditContext, type EditRefIds } from './edit-context'
import type { CopyRefIds } from './history-context'
import { toHistoryTurns } from './history-turns'

export interface DayOverview {
	summary: DaySummary
	goal: DailyGoal | null
	totals: DayTotals
}

interface BuildContextParams {
	userId: string
	timezone: string
	addressForm?: AddressForm
	message: MessageWithAttachments
	/** The words of the user's message; photo-only has none. */
	text?: string
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

const FACT_REF_PREFIX = 'f'
const CONTEXT_WEIGHT_COUNT = 2
const MEASUREMENT_KINDS = [MeasurementKind.WEIGHT, MeasurementKind.WAIST] as const

const toDbDate = (date: string): Date => new Date(`${date}T00:00:00Z`)

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
		private readonly chatEarlier: ChatEarlierService,
		private readonly entriesService: EntriesService,
		private readonly goalsService: GoalsService,
		private readonly measurementsService: MeasurementsService,
		private readonly profileService: ProfileService,
		private readonly workoutsTurn: WorkoutsTurnService,
		private readonly factsService: FactsService,
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

	/** Today − 3 … today + 1: kcal, entries and the overshoot of past days, all counted here. */
	private async getDaysContext(userId: string, today: string): Promise<DayContext[]> {
		const [totalsByDay, goalKcalByDay] = await Promise.all([
			this.entriesService.getDaysKcal(userId, {
				from: toDbDate(shiftDate(today, -ENTRY_BACKDATE_MAX_DAYS)),
				to: toDbDate(shiftDate(today, ENTRY_AHEAD_MAX_DAYS)),
			}),
			this.goalsService.getGoalKcalByDay(
				userId,
				getLoggableDays(today).map(({ localDate }) => localDate),
			),
		])
		return buildDaysContext({ today, totalsByDay, goalKcalByDay })
	}

	/** The stored values of the last week: the only ones the model may fix or delete far back. */
	private async getRecentMeasurements(
		userId: string,
		localDate: Date,
	): Promise<RecentMeasurementContext[]> {
		const from = addDays(localDate, -MEASUREMENT_FIX_MAX_DAYS)
		const perKind = await Promise.all(
			MEASUREMENT_KINDS.map((kind) =>
				this.measurementsService.findInRange({ userId, kind, from, to: localDate }),
			),
		)
		return perKind.flat().map(({ kind, localDate: day, value }) => ({
			kind,
			localDate: formatDbDate(day),
			value,
		}))
	}

	/** The latest weights and waist to compare a new one with; the model calculates nothing. */
	private async getMeasurementsContext(
		userId: string,
		localDate: Date,
	): Promise<MeasurementsContext> {
		const [weights, waist, targetWeightKg, recent] = await Promise.all([
			this.measurementsService.findRecent({
				userId,
				kind: MeasurementKind.WEIGHT,
				take: CONTEXT_WEIGHT_COUNT,
			}),
			this.measurementsService.findLatest({ userId, kind: MeasurementKind.WAIST }),
			this.profileService.findTargetWeightKg(userId),
			this.getRecentMeasurements(userId, localDate),
		])
		return {
			today: formatDbDate(localDate),
			weights: weights.map(toPoint),
			waist: waist ? toPoint(waist) : null,
			targetWeightKg,
			recent,
		}
	}

	/** The model input and the ref → id maps its edit and copy tools are checked against. */
	async buildContext({
		userId,
		timezone,
		addressForm,
		message,
		text = '',
		now,
		localDate,
		memory,
	}: BuildContextParams): Promise<{
		context: FoodParseContext
		refIds: EditRefIds
		workoutRefIds: WorkoutRefIds
		copyRefIds: CopyRefIds
		/** `f1…` → the id of the fact the model saw under that ref. */
		factRefIds: ReadonlyMap<string, string>
	}> {
		const today = formatDbDate(localDate)
		const [
			{ summary, goal, totals },
			history,
			editable,
			measurements,
			days,
			earlier,
			workouts,
			facts,
		] = await Promise.all([
			this.getDayOverview(userId, localDate),
			this.chatRepository.findHistory({
				userId,
				beforeId: message.id,
				limit: HISTORY_MAX_MESSAGES,
			}),
			// entries of other days written today stay editable in the chat
			this.entriesService.getEditableEntries(userId, localDate, {
				from: toDbDate(shiftDate(today, -ENTRY_BACKDATE_MAX_DAYS)),
				to: toDbDate(shiftDate(today, ENTRY_AHEAD_MAX_DAYS)),
				createdSince: getZonedMoment(localDate, 0, timezone),
			}),
			this.getMeasurementsContext(userId, localDate),
			this.getDaysContext(userId, today),
			this.chatEarlier.getContext({ userId, text, today }),
			this.workoutsTurn.getContext({ userId, localDate, timezone, text }),
			this.factsService.findContextFacts(userId),
		])
		const clarifications = await this.clarificationsRepository.findOpenClarifications({
			userId,
			entryIds: editable.active.map((entry) => entry.id),
			// a few spare: questions whose entries fell out of the context are skipped
			take: MAX_CONTEXT_OPEN_CLARIFICATIONS * 2,
		})
		const valuesBefore = await this.entriesService.getValuesBefore(
			userId,
			editable.active.filter((entry) => entry.isEdited).map((entry) => entry.id),
		)
		const { refIds, refByEntryId, ...edit } = buildEditContext({
			active: editable.active,
			deleted: editable.deleted,
			clarifications,
			valuesBefore,
			today,
		})
		// all the day's entries, not only the windowed ones: a turn whose entries lost their refs
		// must still read as logged
		const entryIdsBySourceMessageId = groupEntryIdsBySourceMessage(editable.sourceMessages)
		const confirmedIds = facts.confirmed.map(({ id }) => id)
		const factContexts: FactContext[] = facts.confirmed.map(({ text }, index) => ({
			ref: `${FACT_REF_PREFIX}${index + 1}`,
			text,
		}))
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
				...(addressForm ? { addressForm } : {}),
				dayTotals: summary.totals,
				meals: summary.meals,
				...edit,
				// no section at all unless there is something to say
				...(workouts.workouts.length > 0 ? { workouts: workouts.workouts } : {}),
				...(workouts.deletedWorkouts.length > 0
					? { deletedWorkouts: workouts.deletedWorkouts }
					: {}),
				...(workouts.exercises.length > 0 ? { exercises: workouts.exercises } : {}),
				goal: goalContext,
				days,
				measurements,
				memory,
				// no block at all unless there is a fact or a proposal
				...(factContexts.length > 0 ? { facts: factContexts } : {}),
				...(facts.proposal ? { proposedFact: facts.proposal.text } : {}),
				// no section at all unless the message points back
				...(earlier.earlier.length > 0 ? { earlier: earlier.earlier } : {}),
				history: history
					.reverse()
					.flatMap((turn) => toHistoryTurns(turn, refByEntryId, entryIdsBySourceMessageId)),
			},
			refIds,
			workoutRefIds: workouts.refIds,
			copyRefIds: earlier.copyRefIds,
			factRefIds: new Map(factContexts.map(({ ref }, index) => [ref, confirmedIds[index] ?? ''])),
		}
	}
}
