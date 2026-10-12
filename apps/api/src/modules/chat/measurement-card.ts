import {
	getIsGoalReached,
	MEASUREMENT_CHART_MAX_POINTS,
	type MeasurementCard,
	type MeasurementChartPoint,
} from '@kus/shared'

import { addDays, formatDbDate } from '../../common/time'
import { GoalType, MeasurementKind } from '../../generated/prisma/client'
import type { MeasurementValue } from '../measurements/measurements.mapper'
import type { WeightGoal } from '../profile/profile.types'

const TENTHS = 10
const DAYS_IN_WEEK = 7
/** «Тиждень тому» is the nearest value 5–9 days back. */
const WEEK_CHANGE_MIN_DAYS = 5
const WEEK_CHANGE_MAX_DAYS = 9

/** How far back the chart reaches: its weekly windows end on the card's day. */
export const MEASUREMENT_CHART_SPAN_DAYS = MEASUREMENT_CHART_MAX_POINTS * DAYS_IN_WEEK - 1

const MS_IN_DAY = 24 * 60 * 60 * 1000

const getDayDistance = (later: Date, earlier: Date): number =>
	Math.round((later.getTime() - earlier.getTime()) / MS_IN_DAY)

/** a − b for one-decimal values, taken in tenths so the result carries no float noise. */
const subtract = (a: number, b: number): number =>
	(Math.round(a * TENTHS) - Math.round(b * TENTHS)) / TENTHS

/**
 * The value `weekChange` compares with: of the rows 5–9 days before the card's day, the nearest
 * to 7 days (a tie takes the later day). null when there is none.
 */
const findWeekAgo = (row: MeasurementValue, history: MeasurementValue[]): MeasurementValue | null =>
	history.reduce<MeasurementValue | null>((best, candidate) => {
		const age = getDayDistance(row.localDate, candidate.localDate)
		if (age < WEEK_CHANGE_MIN_DAYS || age > WEEK_CHANGE_MAX_DAYS) return best
		if (best === null) return candidate
		const bestOffset = Math.abs(getDayDistance(row.localDate, best.localDate) - DAYS_IN_WEEK)
		const offset = Math.abs(age - DAYS_IN_WEEK)
		const isLater = candidate.localDate.getTime() > best.localDate.getTime()
		return offset < bestOffset || (offset === bestOffset && isLater) ? candidate : best
	}, null)

/**
 * Up to 5 weekly points ending on the card's day: the week i is the 7 days ending `7·i` days before
 * it, and its point is the latest value inside (a week without one is skipped). Oldest first.
 */
const buildChart = (
	row: MeasurementValue,
	history: MeasurementValue[],
): MeasurementChartPoint[] => {
	const points: MeasurementChartPoint[] = []
	for (let week = 0; week < MEASUREMENT_CHART_MAX_POINTS; week += 1) {
		const end = addDays(row.localDate, -week * DAYS_IN_WEEK)
		const start = addDays(end, -(DAYS_IN_WEEK - 1))
		const latest = history.reduce<MeasurementValue | null>(
			(best, candidate) =>
				candidate.localDate >= start &&
				candidate.localDate <= end &&
				(best === null || candidate.localDate > best.localDate)
					? candidate
					: best,
			null,
		)
		if (latest) points.unshift({ localDate: formatDbDate(latest.localDate), value: latest.value })
	}
	return points
}

/** Kg left in the direction of the goal; 0 once reached or passed, null without a target. */
const getKgToGoal = ({
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
		goalType === GoalType.LOSE ? subtract(current, target) : subtract(target, current),
	)
}

interface MeasurementCardInput {
	row: MeasurementValue
	/** The first value of this kind by creation time. */
	start: MeasurementValue | null
	/** Values of this kind around the card's day (at least `MEASUREMENT_CHART_SPAN_DAYS` back). */
	history: MeasurementValue[]
	goal: WeightGoal
}

/** A value as the chat card shows it: a snapshot at the card's own day, all numbers from the backend. */
export const buildMeasurementCard = ({
	row,
	start,
	history,
	goal,
}: MeasurementCardInput): MeasurementCard => {
	const isWeight = row.kind === MeasurementKind.WEIGHT
	const { goalType, targetWeightKg } = goal
	const hasDirection = isWeight && goalType !== null && goalType !== GoalType.MAINTAIN
	const weekAgo = findWeekAgo(row, history)
	return {
		id: row.id,
		kind: row.kind,
		value: row.value,
		localDate: formatDbDate(row.localDate),
		source: row.source,
		// the first value has nothing to be compared with
		fromStart: start && start.id !== row.id ? subtract(row.value, start.value) : null,
		toGoal: hasDirection
			? getKgToGoal({ goalType, current: row.value, target: targetWeightKg })
			: null,
		isGoalReached: isWeight
			? getIsGoalReached({ goalType, current: row.value, target: targetWeightKg })
			: null,
		weekChange: weekAgo ? subtract(row.value, weekAgo.value) : null,
		planPaceKgPerWeek: hasDirection ? goal.paceKgPerWeek : null,
		chart: buildChart(row, history),
	}
}
