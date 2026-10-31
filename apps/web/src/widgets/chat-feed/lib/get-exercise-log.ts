import type { WorkoutExerciseResponse, WorkoutResponse } from '@kus/shared'
import type { TFunction } from 'i18next'

import { getWorkoutCounts } from '@/entities/workout'
import { formatTime } from '@/shared/lib'

import { formatFooterCounts } from './format-workout-counts'

export interface ExerciseLogView {
	exercises: WorkoutExerciseResponse[]
	/** «Тренування · 18:30»; without a start, «Тренування». */
	title: string
	/** «3 вправи · 6 підходів», as the session was when this card was written; null when empty. */
	counts: string | null
	/** The exercise was added after the session was closed. */
	isChanged: boolean
}

const toMs = (value: string | null): number | null => (value === null ? null : Date.parse(value))

/**
 * What the cards of one message say about their session. The counter is «on that moment»: only the
 * exercises written no later than the newest one of these cards (an older card keeps its numbers
 * after more exercises came), computed from `performedAt`. An exercise without a time counts all.
 */
export const getExerciseLog = (
	workout: Pick<WorkoutResponse, 'startedAt' | 'finishedAt' | 'exercises'>,
	exerciseIds: readonly string[],
	t: TFunction,
): ExerciseLogView => {
	const ids = new Set(exerciseIds)
	const exercises = workout.exercises.filter((exercise) => ids.has(exercise.id))
	const times = exercises.map((exercise) => toMs(exercise.performedAt))
	const knownTimes = times.filter((time): time is number => time !== null)
	const cutoff =
		knownTimes.length === times.length && times.length > 0 ? Math.max(...knownTimes) : null
	const atThatMoment =
		cutoff === null
			? workout.exercises
			: workout.exercises.filter((exercise) => {
					const time = toMs(exercise.performedAt)
					return time === null || time <= cutoff
				})

	const finishedAt = toMs(workout.finishedAt)
	const title =
		workout.startedAt === null
			? t('workout.log.title')
			: t('workout.log.titleAt', { time: formatTime(new Date(workout.startedAt)) })
	// +2 for the colon and the space before the counter
	const counts = formatFooterCounts(getWorkoutCounts(atThatMoment), t, title.length + 2)
	return {
		exercises,
		title,
		counts,
		isChanged: finishedAt !== null && knownTimes.some((time) => time > finishedAt),
	}
}
