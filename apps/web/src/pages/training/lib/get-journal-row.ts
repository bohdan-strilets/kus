import { TRAINING_GROUP_ORDER, type TrainingGroupKey, type WorkoutResponse } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatWorkoutDuration, formatWorkoutKind, hasKnownPlace } from '@/entities/workout'
import { getTrainingSessionPath } from '@/shared/config'
import {
	formatDayMonth,
	formatTime,
	formatWeekdayLong,
	formatWeekdayShort,
	toCalendarDate,
} from '@/shared/lib'

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
	/** The template of a program day, «Тренування А»: shown small and muted after the title. */
	templateName: string | null
	/** «07:10»: the start, for the rows of a day's sheet; null elsewhere and without a start. */
	time: string | null
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

// Without a place the template name stands in for the kind instead of being shown twice.
const getRowTemplateName = (workout: WorkoutResponse): string | null =>
	hasKnownPlace(workout) ? workout.templateName : null

const getTitle = (workout: WorkoutResponse, t: TFunction, isSpoken: boolean): string => {
	const kind =
		!hasKnownPlace(workout) && workout.templateName !== null
			? workout.templateName
			: formatWorkoutKind(workout.place, t)
	const duration = formatWorkoutDuration(workout, t, isSpoken)
	return duration === null ? kind : t('training.journal.rowTitle', { kind, duration })
}

// the spoken label keeps the template in the line: «Зал · 62 хв · Тренування А»
const getSpokenTitle = (workout: WorkoutResponse, t: TFunction): string => {
	const title = getTitle(workout, t, true)
	const templateName = getRowTemplateName(workout)
	return templateName === null
		? title
		: t('training.journal.rowWithTemplate', { title, template: templateName })
}

/** Everything a row of the journal shows, as text: the view stays presentational. */
export const getJournalRow = (
	workout: WorkoutResponse,
	t: TFunction,
	{ isTimeShown = false }: { isTimeShown?: boolean } = {},
): JournalRow => {
	const time =
		isTimeShown && workout.startedAt !== null ? formatTime(new Date(workout.startedAt)) : null
	const groups = getWorkoutGroups(workout)
	const recordCount = getRecordCount(workout)
	const limit = recordCount > 0 ? GROUP_TAGS_MAX_WITH_RECORDS : GROUP_TAGS_MAX
	const date = toCalendarDate(workout.localDate)
	const ariaLabel = [
		t('training.journal.rowDate', { weekday: formatWeekdayLong(date), date: formatDayMonth(date) }),
		getSpokenTitle(workout, t),
		time ?? '',
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
		templateName: getRowTemplateName(workout),
		time,
		groups: groups.slice(0, limit),
		hiddenGroupCount: Math.max(0, groups.length - limit),
		recordCount,
		ariaLabel,
	}
}
