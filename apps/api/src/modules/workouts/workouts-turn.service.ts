import { Injectable, Logger } from '@nestjs/common'
import {
	type ExerciseContext,
	getOpenWorkoutSince,
	isWorkoutOpen,
	type LogWorkoutInput,
	MAX_CONTEXT_DELETED_WORKOUTS,
	MAX_CONTEXT_EXERCISES,
	type TodayWorkoutContext,
	type WorkoutCard,
	type WorkoutResponse,
} from '@kus/shared'

import { formatLocalClock } from '../../common/time'
import type { Prisma } from '../../generated/prisma/client'
import { isExerciseNamed } from './exercise-names'
import { toId, type WorkoutRefIds } from './workout-refs'
import { getRecordKeys, getSessionMessageIds, hasNewRecord, toWorkoutCard } from './workout-session'
import { WorkoutSessionsService } from './workout-sessions.service'
import { getLastPerformedAt, toExerciseContext, toWorkoutContext } from './workout-turn'
import { toWorkoutResponse } from './workouts.mapper'
import { type WorkoutWithExercises, WorkoutsRepository } from './workouts.repository'

export { NO_WORKOUT_REFS, type WorkoutRefIds } from './workout-refs'

/** The dictionary rows a message is matched against; a user with more has older ones forgotten. */
const DICTIONARY_SCAN_LIMIT = 300

export interface WorkoutsContext {
	workouts: TodayWorkoutContext[]
	deletedWorkouts: TodayWorkoutContext[]
	exercises: ExerciseContext[]
	refIds: WorkoutRefIds
}

/** The workouts a chat message shows, and how each of them shows on it. */
export interface MessageWorkouts {
	workouts: WorkoutResponse[]
	workoutCards: WorkoutCard[]
}

/** What a turn does to workouts: the chat's model decisions become rows here. */
@Injectable()
export class WorkoutsTurnService {
	private readonly logger = new Logger(WorkoutsTurnService.name)

	constructor(
		private readonly workoutsRepository: WorkoutsRepository,
		private readonly sessions: WorkoutSessionsService,
	) {}

	/**
	 * Today's workouts (w1…) with a still open one of the day before first, the ones deleted today,
	 * and the dictionary exercises the text names plus those of the listed workouts.
	 */
	async getContext({
		userId,
		localDate,
		timezone,
		text,
		now,
	}: {
		userId: string
		localDate: Date
		timezone: string
		text: string
		now: Date
	}): Promise<WorkoutsContext> {
		const [ofDay, recent, deleted, dictionary] = await Promise.all([
			this.workoutsRepository.findOfDay({ userId, localDate }),
			this.workoutsRepository.findRecent({
				userId,
				since: getOpenWorkoutSince(now),
			}),
			this.workoutsRepository.findDeletedOfDay({
				userId,
				localDate,
				take: MAX_CONTEXT_DELETED_WORKOUTS,
			}),
			this.workoutsRepository.findDictionary({ userId, take: DICTIONARY_SCAN_LIMIT }),
		])
		const nightBefore = recent.filter((workout) => {
			const last = getLastPerformedAt(workout)
			return workout.localDate < localDate && last !== null && isWorkoutOpen(last, now)
		})
		const active = [...nightBefore, ...ofDay]
		const activeRefs = active.map((workout, index) => ({ workout, ref: `w${index + 1}` }))
		const deletedRefs = deleted.map((workout, index) => ({
			workout,
			ref: `w${active.length + index + 1}`,
		}))

		const sessionExerciseIds = new Set(
			active.flatMap((workout) => workout.exercises.flatMap(({ exerciseId }) => exerciseId ?? [])),
		)
		const listed = [
			...dictionary.filter((exercise) => isExerciseNamed(text, exercise)),
			...dictionary.filter(
				(exercise) => sessionExerciseIds.has(exercise.id) && !isExerciseNamed(text, exercise),
			),
		].slice(0, MAX_CONTEXT_EXERCISES)
		const exerciseRefs = new Map(listed.map((exercise, index) => [exercise.id, `x${index + 1}`]))
		const exercises = await Promise.all(
			listed.map(async (exercise, index) =>
				toExerciseContext(exercise, {
					ref: `x${index + 1}`,
					last: await this.workoutsRepository.findLastResult({
						userId,
						exerciseId: exercise.id,
					}),
				}),
			),
		)
		const toContext = (workout: WorkoutWithExercises, ref: string): TodayWorkoutContext => {
			const last = getLastPerformedAt(workout)
			// a workout of another day has no clock time; its entries sit at noon
			if (workout.startedAt === null) {
				return toWorkoutContext(workout, { ref, time: null, lastAt: null, exerciseRefs })
			}
			return toWorkoutContext(workout, {
				ref,
				time: formatLocalClock(workout.startedAt, timezone),
				lastAt: last === null ? null : formatLocalClock(last, timezone),
				exerciseRefs,
			})
		}
		return {
			workouts: activeRefs.map(({ workout, ref }) => toContext(workout, ref)),
			deletedWorkouts: deletedRefs.map(({ workout, ref }) => toContext(workout, ref)),
			exercises,
			refIds: {
				workouts: new Map(activeRefs.map(({ workout, ref }) => [ref, workout.id])),
				deletedWorkouts: new Map(deletedRefs.map(({ workout, ref }) => [ref, workout.id])),
				exercises: new Map(listed.map((exercise, index) => [`x${index + 1}`, exercise.id])),
			},
		}
	}

	/**
	 * Writes the workouts of a turn: a new session, a replaceRef rewriting one in place, or an
	 * appendRef adding to one. Returns the earlier messages whose cards changed and whether the turn
	 * set a record its sessions did not hold before (the sound).
	 */
	async logWorkouts(
		{
			userId,
			sourceMessageId,
			now,
			localDate,
			workouts,
			refIds,
		}: {
			userId: string
			sourceMessageId: string
			now: Date
			/** The user's today; a workout of another day gets the middle of it as its time. */
			localDate: Date
			workouts: LogWorkoutInput[]
			refIds: WorkoutRefIds
		},
		tx: Prisma.TransactionClient,
	): Promise<{ sourceMessageIds: string[]; hasNewRecord: boolean }> {
		const sourceMessageIds = new Set<string>()
		let isNewRecord = false
		for (const input of workouts) {
			// first: an exercise of this same call then takes the fixed group
			await this.sessions.applyGroupFixes({ userId, fixes: input.exerciseGroups, refIds }, tx)
			const change = await this.sessions.writeSession(
				{ userId, sourceMessageId, now, localDate, input, refIds },
				tx,
			)
			if (change === null) continue
			const records = await this.sessions.saveRecords(userId, change.workout, tx)
			const recordsAfter = getRecordKeys(records, change.workout.exercises)
			isNewRecord ||= hasNewRecord(change.recordsBefore, recordsAfter)
			for (const id of change.messageIds) sourceMessageIds.add(id)
			this.logger.log(
				`Workout logged user=${userId} workout=${change.workout.id} exercises=${change.workout.exercises.length}`,
			)
		}
		return { sourceMessageIds: [...sourceMessageIds], hasNewRecord: isNewRecord }
	}

	/** Soft-deletes workouts by their refs; the messages whose cards change are returned. */
	async deleteByRefs(
		{ userId, refs, refIds }: { userId: string; refs: string[]; refIds: WorkoutRefIds },
		tx: Prisma.TransactionClient,
	): Promise<string[]> {
		return this.flip(
			{ userId, ids: refs.map((ref) => toId(refIds.workouts, ref)), isDeleted: true },
			tx,
		)
	}

	/** Brings workouts deleted today back by their refs. */
	async restoreByRefs(
		{ userId, refs, refIds }: { userId: string; refs: string[]; refIds: WorkoutRefIds },
		tx: Prisma.TransactionClient,
	): Promise<string[]> {
		return this.flip(
			{ userId, ids: refs.map((ref) => toId(refIds.deletedWorkouts, ref)), isDeleted: false },
			tx,
		)
	}

	/**
	 * The cards of the chat by user message: the summary of the sessions it finished and the
	 * exercises it added to the others.
	 */
	async getByMessages(userId: string, messageIds: string[]): Promise<Map<string, MessageWorkouts>> {
		const byMessage = new Map<string, MessageWorkouts>()
		if (messageIds.length === 0) return byMessage
		const rows = await this.workoutsRepository.findBySourceMessages({ userId, messageIds })
		const responses = new Map(rows.map((row) => [row.id, toWorkoutResponse(row)]))
		for (const messageId of messageIds) {
			for (const row of rows) {
				const card = toWorkoutCard(row, messageId)
				const response = responses.get(row.id)
				if (card === null || response === undefined) continue
				const current = byMessage.get(messageId) ?? { workouts: [], workoutCards: [] }
				byMessage.set(messageId, {
					workouts: [...current.workouts, response],
					workoutCards: [...current.workoutCards, card],
				})
			}
		}
		return byMessage
	}

	private async flip(
		{ userId, ids, isDeleted }: { userId: string; ids: string[]; isDeleted: boolean },
		tx: Prisma.TransactionClient,
	): Promise<string[]> {
		const messageIds: string[] = []
		for (const id of ids) {
			const changed = isDeleted
				? await this.workoutsRepository.softDelete({ userId, id }, tx)
				: await this.workoutsRepository.restore({ userId, id }, tx)
			const workout = await this.workoutsRepository.findOwned({ userId, id }, tx)
			// every message showing a part of the session gets its card turned into the line
			if (changed && workout) messageIds.push(...getSessionMessageIds(workout))
		}
		return [...new Set(messageIds)]
	}
}
