import {
	type FoodParseContext,
	getDayOffset,
	MEASUREMENT_FIX_MAX_DAYS,
	type RecentMeasurementContext,
} from '@kus/shared'

import { buildDays } from './cases/case-builders.js'

/** The stored values of the last days that the case's weights and waist already describe. */
const getRecentMeasurements = ({
	today,
	weights,
	waist,
}: FoodParseContext['measurements']): RecentMeasurementContext[] =>
	[
		...weights.map(({ value, localDate }) => ({ kind: 'WEIGHT' as const, localDate, value })),
		...(waist ? [{ kind: 'WAIST' as const, localDate: waist.localDate, value: waist.value }] : []),
	]
		.filter(({ localDate }) => getDayOffset(localDate, today) >= -MEASUREMENT_FIX_MAX_DAYS)
		.sort((a, b) => a.localDate.localeCompare(b.localDate))

/**
 * Fills what the backend always sends and a case leaves out: "Days" (empty days around the case's
 * today) and "Recent measurements" (from the case's weights and waist). A case that sets them wins.
 */
export const withDayContext = (context: FoodParseContext): FoodParseContext => ({
	...context,
	days: context.days ?? buildDays(context.measurements.today),
	measurements: {
		...context.measurements,
		recent: context.measurements.recent ?? getRecentMeasurements(context.measurements),
	},
})
