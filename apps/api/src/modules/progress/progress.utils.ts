import { GoalType } from '../../generated/prisma/client'
import type { MeasurementValue } from '../measurements/measurements.mapper'
import { findWeekAgo, getDayDistance, subtractTenths } from '../measurements/measurements.utils'
import {
	SATURDAY,
	SUNDAY,
	WEEK_PACE_MAX_AGE_DAYS,
	WEEKEND_PROTEIN_LOW_RATIO,
} from './progress.constants'

export interface ProteinDay {
	localDate: string
	proteinG: number
	hasEntries: boolean
}

const average = (values: number[]): number =>
	values.reduce((sum, value) => sum + value, 0) / values.length

const isWeekend = (localDate: string): boolean => {
	const weekday = new Date(`${localDate}T00:00:00Z`).getUTCDay()
	return weekday === SATURDAY || weekday === SUNDAY
}

/** Whole numbers for the screen; null when no day has entries. */
export const averageOrNull = (values: number[]): number | null =>
	values.length === 0 ? null : Math.round(average(values))

/**
 * Weekend protein is low when the Saturday–Sunday average is under 0.85 of the weekday average.
 * Days without entries are skipped; with no data in either group there is nothing to compare.
 */
export const getIsWeekendProteinLow = (days: ProteinDay[]): boolean => {
	const logged = days.filter((day) => day.hasEntries)
	const weekend = logged.filter((day) => isWeekend(day.localDate))
	const weekdays = logged.filter((day) => !isWeekend(day.localDate))
	if (weekend.length === 0 || weekdays.length === 0) return false
	const weekdayAverage = average(weekdays.map((day) => day.proteinG))
	return average(weekend.map((day) => day.proteinG)) < weekdayAverage * WEEKEND_PROTEIN_LOW_RATIO
}

/**
 * The latest weight minus the nearest one 5–9 days before it. null without such a weight, and when
 * the latest weigh-in is older than a week — then it says nothing about this week.
 */
export const getWeekPaceKg = ({
	latest,
	history,
	today,
}: {
	latest: MeasurementValue | null
	history: MeasurementValue[]
	today: Date
}): number | null => {
	if (!latest || getDayDistance(today, latest.localDate) > WEEK_PACE_MAX_AGE_DAYS) return null
	const weekAgo = findWeekAgo(latest, history)
	return weekAgo ? subtractTenths(latest.value, weekAgo.value) : null
}

export const hasWeightDirection = (goalType: GoalType | null): goalType is 'LOSE' | 'GAIN' =>
	goalType === GoalType.LOSE || goalType === GoalType.GAIN
