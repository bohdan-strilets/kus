import { TRAINING_GROUP_ORDER, type TrainingGroupKey, type WorkoutResponse } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatWorkoutKind } from '@/entities/workout'
import { formatDayHeading, toCalendarDate } from '@/shared/lib'
import type { WeekStripDay } from '@/shared/ui'

import { getWorkoutGroups } from './get-journal-row'
import type { WeekSummary } from './get-week-summary'

export interface TrainingWeekDay extends WeekStripDay {
	localDate: string
	workouts: WorkoutResponse[]
	groups: TrainingGroupKey[]
	/** A day of the program that is still ahead (or today) and has no training: a ring. */
	isPlanned: boolean
}

interface WeekDaysInput {
	summary: WeekSummary
	today: string
	/** ISO weekdays of the program (only «За днями тижня» names them). */
	programWeekdays: ReadonlySet<number>
	t: TFunction
}

const getDayGroups = (workouts: readonly WorkoutResponse[]): TrainingGroupKey[] => {
	const present = new Set(workouts.flatMap((workout) => getWorkoutGroups(workout)))
	return TRAINING_GROUP_ORDER.filter((group) => present.has(group))
}

// a day of trainings without any group is named by its place: «зал»
const getTrainedLabel = (
	day: string,
	groups: readonly TrainingGroupKey[],
	workouts: readonly WorkoutResponse[],
	t: TFunction,
): string => {
	const names =
		groups.length > 0
			? groups.map((group) => t(`muscle.${group}`))
			: workouts.map((workout) => formatWorkoutKind(workout.place, t))
	return t('week.dayTraining', {
		day,
		groups: names.map((name) => name.toLocaleLowerCase('uk')).join(', '),
	})
}

/** The seven days of «Цей тиждень» as the shared strip wants them: the pill is today, a day ahead has a ring. */
export const getTrainingWeekDays = ({
	summary,
	today,
	programWeekdays,
	t,
}: WeekDaysInput): TrainingWeekDay[] =>
	summary.days.map((day) => {
		const date = toCalendarDate(day.localDate)
		const groups = getDayGroups(day.workouts)
		const isPlanned =
			!day.hasTraining && day.localDate >= today && programWeekdays.has(day.isoWeekday)
		const dayName = formatDayHeading(date)
		const getAriaLabel = (): string => {
			if (day.hasTraining) return getTrainedLabel(dayName, groups, day.workouts, t)
			return t(isPlanned ? 'week.dayPlanned' : 'week.dayNoTraining', { day: dayName })
		}
		return {
			date,
			localDate: day.localDate,
			workouts: day.workouts,
			groups,
			isPlanned,
			isToday: day.localDate === today,
			isUpcoming: day.localDate > today,
			isSelected: day.localDate === today,
			isDisabled: !day.hasTraining,
			ariaLabel: getAriaLabel(),
		}
	})
