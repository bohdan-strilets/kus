import { TRAINING_GROUP_ORDER, type TrainingGroupKey, type WorkoutResponse } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatWorkoutDuration } from '@/entities/workout'
import { getTrainingSessionPath } from '@/shared/config'
import { formatTime } from '@/shared/lib'

export interface TrainingStripView {
	id: string
	href: string
	/** Named («62 хв») or estimated («≈ 62 хв»); null when the session has no duration at all. */
	duration: string | null
	/** «07:10»: only when the day has several trainings and this one has a start. */
	time: string | null
	groups: TrainingGroupKey[]
	ariaLabel: string
}

/** The groups a session touched in the fixed display order; cardio comes from the kind, not a group. */
export const getSessionGroups = (workout: WorkoutResponse): TrainingGroupKey[] => {
	const present = new Set<string>()
	for (const exercise of workout.exercises) {
		if (exercise.kind === 'CARDIO') present.add('CARDIO')
		else if (exercise.muscleGroup !== null) present.add(exercise.muscleGroup)
	}
	return TRAINING_GROUP_ORDER.filter((group) => present.has(group))
}

/** In the order of the day; a session without a start goes after the timed ones. */
export const sortWorkoutsByTime = (workouts: readonly WorkoutResponse[]): WorkoutResponse[] =>
	[...workouts].sort((left, right) => {
		if (left.startedAt === right.startedAt) return 0
		if (left.startedAt === null) return 1
		if (right.startedAt === null) return -1
		return left.startedAt < right.startedAt ? -1 : 1
	})

export const getTrainingStripView = (
	workout: WorkoutResponse,
	t: TFunction,
	hasSiblings: boolean,
): TrainingStripView => {
	const groups = getSessionGroups(workout)
	const time =
		hasSiblings && workout.startedAt !== null ? formatTime(new Date(workout.startedAt)) : null
	const spokenDuration = formatWorkoutDuration(workout, t, true)
	const groupNames = groups.map((group) => t(`muscle.${group}`).toLocaleLowerCase('uk'))

	const ariaLabel = t('today.trainingStrip.aria.open', {
		summary: [
			t(time === null ? 'today.trainingStrip.aria.title' : 'today.trainingStrip.aria.titleAt', {
				time,
			}),
			spokenDuration === null
				? ''
				: t('today.trainingStrip.aria.durationPart', { duration: spokenDuration }),
			groupNames.length === 0
				? ''
				: t('today.trainingStrip.aria.groupsPart', { groups: groupNames.join(', ') }),
		].join(''),
	})

	return {
		id: workout.id,
		href: getTrainingSessionPath(workout.id),
		duration: formatWorkoutDuration(workout, t),
		time,
		groups,
		ariaLabel,
	}
}
