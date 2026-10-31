import { TRAINING_GROUP_ORDER, type TrainingGroupKey, type WorkoutResponse } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatWorkoutDuration, formatWorkoutKind } from '@/entities/workout'
import { getTrainingSessionPath } from '@/shared/config'
import { formatDayMonth, formatWeekdayLong, formatWeekdayShort, toCalendarDate } from '@/shared/lib'

import { GROUP_TAGS_MAX, GROUP_TAGS_MAX_WITH_RECORDS } from './training.constants'

export interface JournalRow {
	id: string
	href: string
	/** «Пн». */
	weekday: string
	/** «26». */
	day: string
	/** «Зал · 62 хв», «Зал · ≈ 62 хв», just «Зал» without a duration. */
	title: string
	groups: TrainingGroupKey[]
	/** Groups that did not fit into the row: «+5». */
	hiddenGroupCount: number
	recordCount: number
	ariaLabel: string
}

/** The groups of a training in the fixed order; cardio by its kind, strength without a group is left out. */
export const getWorkoutGroups = (
	workout: Pick<WorkoutResponse, 'exercises'>,
): TrainingGroupKey[] => {
	const present = new Set<TrainingGroupKey>()
	for (const exercise of workout.exercises) {
		if (exercise.kind === 'CARDIO') present.add('CARDIO')
		else if (exercise.muscleGroup !== null) present.add(exercise.muscleGroup)
	}
	return TRAINING_GROUP_ORDER.filter((group) => present.has(group))
}

/** Exercises that set a record. */
export const getRecordCount = (workout: Pick<WorkoutResponse, 'exercises'>): number =>
	workout.exercises.filter((exercise) => exercise.record !== null).length

const getTitle = (workout: WorkoutResponse, t: TFunction, isSpoken: boolean): string => {
	const kind = formatWorkoutKind(workout.place, t)
	const duration = formatWorkoutDuration(workout, t, isSpoken)
	return duration === null ? kind : t('training.journal.rowTitle', { kind, duration })
}

/** Everything a row of the journal shows, as text: the view stays presentational. */
export const getJournalRow = (workout: WorkoutResponse, t: TFunction): JournalRow => {
	const groups = getWorkoutGroups(workout)
	const recordCount = getRecordCount(workout)
	const limit = recordCount > 0 ? GROUP_TAGS_MAX_WITH_RECORDS : GROUP_TAGS_MAX
	const date = toCalendarDate(workout.localDate)
	const ariaLabel = [
		t('training.journal.rowDate', { weekday: formatWeekdayLong(date), date: formatDayMonth(date) }),
		getTitle(workout, t, true),
		groups.map((group) => t(`muscle.${group}`)).join(', '),
		recordCount > 0 ? t('training.journal.records', { count: recordCount }) : '',
	]
		.filter((part) => part !== '')
		.join('. ')

	return {
		id: workout.id,
		href: getTrainingSessionPath(workout.id),
		weekday: formatWeekdayShort(date),
		day: String(date.getDate()),
		title: getTitle(workout, t, false),
		groups: groups.slice(0, limit),
		hiddenGroupCount: Math.max(0, groups.length - limit),
		recordCount,
		ariaLabel,
	}
}
