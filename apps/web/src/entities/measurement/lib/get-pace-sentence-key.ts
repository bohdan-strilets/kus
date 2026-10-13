/** Within this many kg of the plan a week counts as «за планом». */
export const PACE_ON_PLAN_TOLERANCE_KG = 0.1
/** Up to this far ahead of the plan it is «трохи швидше». */
export const PACE_SLIGHTLY_FASTER_KG = 0.3
/** A week changed by less than this (after rounding to a tenth) is no change. */
const STEADY_THRESHOLD_KG = 0.05

export type PaceSentenceKey =
	| 'measurement.pace.steady'
	| 'measurement.pace.down.plain'
	| 'measurement.pace.down.onPlan'
	| 'measurement.pace.down.slightlyFaster'
	| 'measurement.pace.down.faster'
	| 'measurement.pace.down.slower'
	| 'measurement.pace.up.plain'
	| 'measurement.pace.up.onPlan'
	| 'measurement.pace.up.slightlyFaster'
	| 'measurement.pace.up.faster'
	| 'measurement.pace.up.slower'

interface PaceInput {
	weekChange: number | null
	/** Magnitude of the planned weekly change; null without a goal direction (and for waist). */
	planPaceKgPerWeek: number | null
	/** Current minus the first weigh-in. */
	fromStart: number | null
}

type PaceComparison = 'plain' | 'onPlan' | 'slightlyFaster' | 'faster' | 'slower'

const compareWithPlan = (change: number, plan: number): PaceComparison => {
	const difference = Math.abs(change) - plan
	if (Math.abs(difference) <= PACE_ON_PLAN_TOLERANCE_KG) return 'onPlan'
	if (difference < 0) return 'slower'
	return difference <= PACE_SLIGHTLY_FASTER_KG ? 'slightlyFaster' : 'faster'
}

/**
 * The numeric half of the card's sentence — «Мінус {{value}} за тиждень, трохи швидше за план — без поспіху.» —
 * as a template key; the number itself is passed to `t`. The model never writes numbers.
 * The card does not say which way the plan goes, so the plan is compared only when the week moved
 * the way the whole path did (same sign as `fromStart`); a week against the trend stays neutral.
 */
export const getPaceSentenceKey = ({
	weekChange,
	planPaceKgPerWeek,
	fromStart,
}: PaceInput): PaceSentenceKey | null => {
	if (weekChange === null) return null
	if (Math.abs(weekChange) < STEADY_THRESHOLD_KG) return 'measurement.pace.steady'
	const direction = weekChange < 0 ? 'down' : 'up'
	const isAlongTrend = fromStart !== null && Math.sign(fromStart) === Math.sign(weekChange)
	const comparison: PaceComparison =
		planPaceKgPerWeek !== null && isAlongTrend
			? compareWithPlan(weekChange, planPaceKgPerWeek)
			: 'plain'
	return `measurement.pace.${direction}.${comparison}`
}
