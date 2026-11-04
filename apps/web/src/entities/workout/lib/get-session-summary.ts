import {
	TRAINING_GROUP_ORDER,
	type TrainingGroupKey,
	type WorkoutExerciseResponse,
	type WorkoutResponse,
} from '@kus/shared'
import type { TFunction } from 'i18next'

import { INTL_LOCALE } from '@/shared/lib'

import { formatWorkoutDistance, formatWorkoutMinutes } from './format-workout'
import { formatSets } from './format-sets'
import { formatSummaryCounts } from './format-workout-counts'
import { getDoneWork } from './get-done-work'
import { getWorkoutCounts } from './get-workout-counts'

export interface SessionSummaryGroup {
	group: TrainingGroupKey
	/** Working sets of the group, or the cardio minutes; undefined when none was named. */
	detail?: string
}

export interface SessionSummaryView {
	counts: string | null
	groups: SessionSummaryGroup[]
	/** «Рекорд: жим лежачи — 70 кг × 5», one per exercise that gave one. */
	records: string[]
}

const isCardio = (exercise: WorkoutExerciseResponse): boolean => exercise.kind === 'CARDIO'

const getRecordValue = (exercise: WorkoutExerciseResponse, t: TFunction): string | null => {
	if (exercise.record === 'DISTANCE') {
		return exercise.distanceM === null ? null : formatWorkoutDistance(exercise.distanceM, t)
	}
	const { segments } = formatSets(exercise, t)
	return segments.find((segment) => segment.kind === 'record')?.text ?? null
}

const getRecords = (exercises: readonly WorkoutExerciseResponse[], t: TFunction): string[] =>
	exercises.flatMap((exercise) => {
		const value = getRecordValue(exercise, t)
		if (exercise.record === null || value === null) return []
		return [
			t('workout.summary.record', {
				name: exercise.name.toLocaleLowerCase(INTL_LOCALE),
				value,
			}),
		]
	})

const getGroups = (
	exercises: readonly WorkoutExerciseResponse[],
	t: TFunction,
): SessionSummaryGroup[] =>
	TRAINING_GROUP_ORDER.flatMap((group): SessionSummaryGroup[] => {
		if (group === 'CARDIO') {
			const cardio = exercises.filter(isCardio)
			if (cardio.length === 0) return []
			const { cardioMinutes } = getWorkoutCounts(cardio)
			return [
				{
					group,
					detail: cardioMinutes === null ? undefined : formatWorkoutMinutes(cardioMinutes, t),
				},
			]
		}
		const members = exercises.filter(
			(exercise) => !isCardio(exercise) && exercise.muscleGroup === group,
		)
		if (members.length === 0) return []
		return [{ group, detail: String(getWorkoutCounts(members).setCount) }]
	})

/** What the summary card of a session says, in the fixed order of the groups. */
export const getSessionSummary = (
	workout: Pick<WorkoutResponse, 'exercises'>,
	t: TFunction,
): SessionSummaryView => {
	const exercises = getDoneWork(workout.exercises)
	return {
		counts: formatSummaryCounts(getWorkoutCounts(exercises), t),
		groups: getGroups(exercises, t),
		records: getRecords(exercises, t),
	}
}
