import {
	getIsGoalReached,
	MEASUREMENT_CHART_MAX_POINTS,
	type MeasurementCard,
	type MeasurementChartPoint,
} from '@kus/shared'

import { addDays, formatDbDate, getLocalDateString } from '../../common/time'
import { GoalType, MeasurementKind } from '../../generated/prisma/client'
import type { MeasurementValue } from '../measurements/measurements.mapper'
import {
	DAYS_IN_WEEK,
	findWeekAgo,
	getKgToGoal,
	subtractTenths,
} from '../measurements/measurements.utils'
import type { WeightGoal } from '../profile/profile.types'

/** How far back the chart reaches: its weekly windows end on the card's day. */
export const MEASUREMENT_CHART_SPAN_DAYS = MEASUREMENT_CHART_MAX_POINTS * DAYS_IN_WEEK - 1

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

interface MeasurementCardInput {
	row: MeasurementValue
	/** The first value of this kind by creation time. */
	start: MeasurementValue | null
	/** Values of this kind around the card's day (at least `MEASUREMENT_CHART_SPAN_DAYS` back). */
	history: MeasurementValue[]
	goal: WeightGoal
	/** The user's, to tell a value written for an earlier day from one written the same day. */
	timezone: string
}

/** A value as the chat card shows it: a snapshot at the card's own day, all numbers from the backend. */
export const buildMeasurementCard = ({
	row,
	start,
	history,
	goal,
	timezone,
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
		// a backdated value was not weighed at that moment, so it has no time to show
		measuredAt:
			getLocalDateString(row.createdAt, timezone) === formatDbDate(row.localDate)
				? row.measuredAt.toISOString()
				: null,
		isDeleted: row.deletedAt !== null,
		// the first value has nothing to be compared with
		fromStart: start && start.id !== row.id ? subtractTenths(row.value, start.value) : null,
		toGoal: hasDirection
			? getKgToGoal({ goalType, current: row.value, target: targetWeightKg })
			: null,
		isGoalReached: isWeight
			? getIsGoalReached({ goalType, current: row.value, target: targetWeightKg })
			: null,
		weekChange: weekAgo ? subtractTenths(row.value, weekAgo.value) : null,
		planPaceKgPerWeek: hasDirection ? goal.paceKgPerWeek : null,
		chart: buildChart(row, history),
	}
}
