import { isWorkoutOpen, LIVE_FINISH_IDLE_MIN, MAX_WORKOUT_MINUTES } from '@kus/shared'

import type { WorkoutWithExercises } from './workouts.repository'

const MS_PER_MINUTE = 60_000
const MIN_DURATION_MIN = 1

type LiveSessionState = Pick<WorkoutWithExercises, 'source' | 'finishedAt' | 'deletedAt'>

type ExerciseActivity = {
	performedAt: Date
	sets?: readonly { doneAt: Date | null }[]
}

type SessionActivity = {
	startedAt?: Date | null
	exercises: readonly ExerciseActivity[]
}

const latest = (dates: readonly (Date | null | undefined)[]): Date | null =>
	dates.reduce<Date | null>(
		(last, date) => (date && (last === null || date > last) ? date : last),
		null,
	)

/** A live session nobody finished or deleted yet. */
export const isOpenLive = (workout: LiveSessionState): boolean =>
	workout.source === 'LIVE' && workout.finishedAt === null && workout.deletedAt === null

/** The last set done or exercise added (a set's `doneAt`, an entry's `performedAt`); null without any. */
export const getLastWorkAt = ({ exercises }: Pick<SessionActivity, 'exercises'>): Date | null =>
	latest(
		exercises.flatMap((exercise) => [
			exercise.performedAt,
			...(exercise.sets ?? []).map((set) => set.doneAt),
		]),
	)

/** The last action of a session: its last work, else its start. Never by the calendar day. */
export const getLastActionAt = (workout: SessionActivity): Date | null =>
	latest([getLastWorkAt(workout), workout.startedAt])

/**
 * The last action of a session counting what a snapshot brings: the later of the stored last
 * action and the given times (the incoming sets' clamped `doneAt`, never the write's `now`).
 */
export const getLastActionAtWith = (
	workout: SessionActivity,
	incoming: readonly Date[],
): Date | null => latest([getLastActionAt(workout), ...incoming])

/**
 * A live session left alone for more than `maxGapHours` (default WORKOUT_APPEND_MAX_GAP_HOURS)
 * since its last action: it is closed on the next look at it. A session past midnight stays open
 * while it goes on.
 */
export const isLiveIdle = (workout: SessionActivity, now: Date, maxGapHours?: number): boolean => {
	const last = getLastActionAt(workout)
	return last === null || !isWorkoutOpen(last, now, maxGapHours)
}

type DoneWorkExercise = Pick<
	WorkoutWithExercises['exercises'][number],
	'clientKey' | 'durationMin' | 'distanceM'
> & { sets: readonly { doneAt: Date | null }[] }

/** The rule of hasDoneWork for one exercise: told in the chat, or live with a done set or cardio. */
export const isDoneExercise = (exercise: DoneWorkExercise): boolean => {
	if (exercise.clientKey === null) return true
	if (exercise.durationMin !== null || exercise.distanceM !== null) return true
	return exercise.sets.some((set) => set.doneAt !== null)
}

/**
 * Something was done. An exercise told in the chat (no clientKey: added by a message, «ще 10 хв
 * доріжки», or rewritten by a replaceRef) always counts: the user said it happened. A live-mode
 * exercise (it has a clientKey) counts by a set marked done, or by cardio minutes or distance; a
 * set only planned is not work.
 */
export const hasDoneWork = (workout: { exercises: readonly DoneWorkExercise[] }): boolean =>
	workout.exercises.some(isDoneExercise)

/**
 * The sets that count as work: all of an exercise told in the chat (they have no doneAt), only the
 * done ones of a live-mode exercise.
 */
export const getDoneSets = <TSet extends { doneAt: Date | null }>(
	exercise: Pick<DoneWorkExercise, 'clientKey'> & { sets: readonly TSet[] },
): readonly TSet[] =>
	exercise.clientKey === null ? exercise.sets : exercise.sets.filter((set) => set.doneAt !== null)

/**
 * When a live session ended: now, unless its last set was done more than LIVE_FINISH_IDLE_MIN ago —
 * then at that set (a late «Завершити», like a late «все» in the chat, does not stretch it).
 */
export const getLiveFinishedAt = (workout: Pick<SessionActivity, 'exercises'>, now: Date): Date => {
	const last = getLastWorkAt(workout)
	if (last === null) return now
	return now.getTime() - last.getTime() > LIVE_FINISH_IDLE_MIN * MS_PER_MINUTE ? last : now
}

/** Whole minutes from the start to the finish, 1–600. */
export const getLiveDurationMin = ({
	startedAt,
	finishedAt,
}: {
	startedAt: Date
	finishedAt: Date
}): number => {
	const minutes = Math.round((finishedAt.getTime() - startedAt.getTime()) / MS_PER_MINUTE)
	return Math.min(MAX_WORKOUT_MINUTES, Math.max(MIN_DURATION_MIN, minutes))
}

/**
 * The finish of a live session (by «Завершити», the auto-close or a «все» in the chat): at the
 * message when it adds exercises, else by getLiveFinishedAt. A duration someone named stays; else
 * it is the time from the start to the finish.
 */
export const getLiveFinishFields = (
	workout: Pick<SessionActivity, 'exercises'> &
		Pick<WorkoutWithExercises, 'startedAt' | 'durationMin'>,
	{
		now,
		addsExercises = false,
		namedDurationMin = null,
	}: { now: Date; addsExercises?: boolean; namedDurationMin?: number | null },
): { finishedAt: Date; durationMin: number } => {
	const finishedAt = addsExercises ? now : getLiveFinishedAt(workout, now)
	return {
		finishedAt,
		durationMin:
			namedDurationMin ??
			workout.durationMin ??
			getLiveDurationMin({ startedAt: workout.startedAt ?? finishedAt, finishedAt }),
	}
}
