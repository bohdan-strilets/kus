import { isWorkoutOpen, type WorkoutCard, type WorkoutRecordType } from '@kus/shared'

import type { WorkoutPlace } from '../../generated/prisma/enums'
import { getLastPerformedAt, type WorkoutRecord } from './workout-turn'
import type { WorkoutWithExercises } from './workouts.repository'

/** Why an appendRef starts a new session instead; the reason goes to the log, never the text. */
export type NewSessionReason = 'deleted' | 'stale' | 'place'

/**
 * Whether an appendRef really adds to the session: not when the session is gone, its last entry is
 * more than 3 h old, or both places are named and differ. Null means append.
 */
export const getNewSessionReason = ({
	workout,
	place,
	now,
}: {
	workout: Pick<WorkoutWithExercises, 'deletedAt' | 'place' | 'exercises'> | null
	place: WorkoutPlace | null
	now: Date
}): NewSessionReason | null => {
	if (workout === null || workout.deletedAt !== null) return 'deleted'
	const last = getLastPerformedAt(workout)
	if (last === null || !isWorkoutOpen(last, now)) return 'stale'
	if (place !== null && workout.place !== null && place !== workout.place) return 'place'
	return null
}

/**
 * The session a «все» closes when the one it points at cannot go on: the last open live one of that
 * day that has entries, or none.
 */
export const findSessionToClose = <
	T extends Pick<WorkoutWithExercises, 'deletedAt' | 'finishedAt' | 'exercises'>,
>(
	sessionsOfDay: readonly T[],
): T | null =>
	sessionsOfDay.findLast(
		(workout) =>
			workout.deletedAt === null && workout.finishedAt === null && workout.exercises.length > 0,
	) ?? null

/** A «все» this long after the last entry still marks the end; later, the session ended at its last entry. */
export const FINISH_AT_MESSAGE_MAX_GAP_MIN = 30
const MS_PER_MINUTE = 60_000

/**
 * When a session that a message closes ended: at that message if it adds exercises or comes within
 * FINISH_AT_MESSAGE_MAX_GAP_MIN of the last entry, otherwise at the last entry, so a late «все»
 * does not stretch the estimated duration.
 */
export const getFinishedAt = ({
	workout,
	addsExercises,
	now,
}: {
	workout: Pick<WorkoutWithExercises, 'exercises'>
	addsExercises: boolean
	now: Date
}): Date => {
	const last = getLastPerformedAt(workout)
	if (addsExercises || last === null) return now
	const gapMs = now.getTime() - last.getTime()
	return gapMs <= FINISH_AT_MESSAGE_MAX_GAP_MIN * MS_PER_MINUTE ? now : last
}

/** Rows added to a session go after every row it already has (`maxPosition` null: none yet). */
export const placeAfter = <T extends { position: number }>(
	rows: readonly T[],
	maxPosition: number | null,
): T[] => {
	const first = maxPosition === null ? 0 : maxPosition + 1
	return rows.map((row, index) => ({ ...row, position: first + index }))
}

type EntryOrigin = { sourceMessageId: string | null; performedAt: Date }

/**
 * A replaced workout keeps where each exercise came from: the n-th new entry of an exercise takes
 * the message and time of the n-th old entry of the same exercise; the rest (new to the session)
 * get `fallback` — the fixing message, so their card shows there.
 */
export const inheritEntryOrigins = ({
	oldEntries,
	newExerciseIds,
	fallback,
}: {
	/** In their order in the session. */
	oldEntries: readonly (EntryOrigin & { exerciseId: string | null })[]
	newExerciseIds: readonly string[]
	fallback: EntryOrigin
}): EntryOrigin[] => {
	const queues = new Map<string, EntryOrigin[]>()
	for (const { exerciseId, sourceMessageId, performedAt } of oldEntries) {
		if (exerciseId === null) continue
		queues.set(exerciseId, [...(queues.get(exerciseId) ?? []), { sourceMessageId, performedAt }])
	}
	return newExerciseIds.map((exerciseId) => queues.get(exerciseId)?.shift() ?? fallback)
}

/** The messages that show a card of the session: those its entries came from and the finishing one. */
export const getSessionMessageIds = (
	workout: Pick<WorkoutWithExercises, 'finishedMessageId' | 'exercises'>,
): string[] => [
	...new Set(
		[...workout.exercises.map((entry) => entry.sourceMessageId), workout.finishedMessageId].filter(
			(id): id is string => id !== null,
		),
	),
]

/**
 * How a workout shows on a message: the summary on the message that finished it, else the exercises
 * the message added; null when the message has no part of it.
 */
export const toWorkoutCard = (
	workout: Pick<WorkoutWithExercises, 'id' | 'finishedMessageId' | 'exercises'>,
	messageId: string,
): WorkoutCard | null => {
	if (workout.finishedMessageId === messageId) {
		return {
			workoutId: workout.id,
			variant: 'SUMMARY',
			exerciseIds: workout.exercises.map(({ id }) => id),
		}
	}
	const added = workout.exercises.filter((entry) => entry.sourceMessageId === messageId)
	if (added.length === 0) return null
	return { workoutId: workout.id, variant: 'EXERCISES', exerciseIds: added.map(({ id }) => id) }
}

const toRecordKey = (exerciseId: string, type: WorkoutRecordType): string => `${exerciseId}:${type}`

/** Records by exercise and type: entry ids change when a workout is replaced, exercises do not. */
export const getRecordKeys = (
	records: readonly WorkoutRecord[],
	entries: readonly { id: string; exerciseId: string | null }[],
): Set<string> => {
	const exerciseIds = new Map(entries.map(({ id, exerciseId }) => [id, exerciseId]))
	return new Set(
		records.flatMap(({ exerciseEntryId, type }) => {
			const exerciseId = exerciseIds.get(exerciseEntryId)
			return exerciseId ? [toRecordKey(exerciseId, type)] : []
		}),
	)
}

/** A record the session did not hold before the turn: the one the sound is for. */
export const hasNewRecord = (before: ReadonlySet<string>, after: ReadonlySet<string>): boolean =>
	[...after].some((key) => !before.has(key))
