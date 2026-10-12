import { GoalType } from '../../generated/prisma/client'
import type { MeasurementValue } from './measurements.mapper'

const TENTHS = 10
export const DAYS_IN_WEEK = 7
/** «Тиждень тому» is the nearest value 5–9 days back. */
const WEEK_CHANGE_MIN_DAYS = 5
export const WEEK_CHANGE_MAX_DAYS = 9

const MS_IN_DAY = 24 * 60 * 60 * 1000

export const getDayDistance = (later: Date, earlier: Date): number =>
	Math.round((later.getTime() - earlier.getTime()) / MS_IN_DAY)

/** a − b for one-decimal values, taken in tenths so the result carries no float noise. */
export const subtractTenths = (a: number, b: number): number =>
	(Math.round(a * TENTHS) - Math.round(b * TENTHS)) / TENTHS

/**
 * The value a week change compares with: of the rows 5–9 days before `row`'s day, the nearest
 * to 7 days (a tie takes the later day). null when there is none.
 */
export const findWeekAgo = (
	row: MeasurementValue,
	history: MeasurementValue[],
): MeasurementValue | null =>
	history.reduce<MeasurementValue | null>((best, candidate) => {
		const age = getDayDistance(row.localDate, candidate.localDate)
		if (age < WEEK_CHANGE_MIN_DAYS || age > WEEK_CHANGE_MAX_DAYS) return best
		if (best === null) return candidate
		const bestOffset = Math.abs(getDayDistance(row.localDate, best.localDate) - DAYS_IN_WEEK)
		const offset = Math.abs(age - DAYS_IN_WEEK)
		const isLater = candidate.localDate.getTime() > best.localDate.getTime()
		return offset < bestOffset || (offset === bestOffset && isLater) ? candidate : best
	}, null)

/** Kg left in the direction of the goal; 0 once reached or passed, null without a target. */
export const getKgToGoal = ({
	goalType,
	current,
	target,
}: {
	goalType: GoalType | null
	current: number
	target: number | null
}): number | null => {
	if (target === null) return null
	return Math.max(
		0,
		goalType === GoalType.LOSE ? subtractTenths(current, target) : subtractTenths(target, current),
	)
}
