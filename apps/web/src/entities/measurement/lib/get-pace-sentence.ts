import type { MeasurementKind } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatMeasurement } from './format-measurement'

/** Within this many kg of the plan a week counts as «якраз за планом». */
export const PACE_ON_PLAN_TOLERANCE_KG = 0.1
/** Up to this far ahead of the plan it is «трохи швидше». */
export const PACE_SLIGHTLY_FASTER_KG = 0.3
/** A week changed by less than this (after rounding to a tenth) is no change. */
export const PACE_STEADY_THRESHOLD_KG = 0.05

export type PaceSentenceKey =
	| `measurement.pace.steady.${MeasurementKind}`
	| `measurement.pace.${'down' | 'up'}.${PaceComparison}`

type PaceComparison = 'plain' | 'onPlan' | 'slightlyFaster' | 'faster' | 'slower'

export interface PaceInput {
	kind: MeasurementKind
	weekChange: number | null
	/** Magnitude of the planned weekly change; null without a goal direction. Ignored for waist. */
	planPaceKgPerWeek: number | null
	/** The week moved the way the goal / the whole path points: only then it is compared with the plan. */
	isAlongPlan: boolean
}

const compareWithPlan = (change: number, plan: number): PaceComparison => {
	const difference = Math.abs(change) - plan
	if (Math.abs(difference) <= PACE_ON_PLAN_TOLERANCE_KG) return 'onPlan'
	if (difference < 0) return 'slower'
	return difference <= PACE_SLIGHTLY_FASTER_KG ? 'slightlyFaster' : 'faster'
}

/**
 * The template key of the weekly-pace sentence, shared by the chat card and the «Прогрес» insight:
 * «Мінус {{value}} за тиждень, трохи швидше за план — без поспіху.» The number is passed to `t`;
 * the model never writes it. A week against the plan's direction, a waist or no plan stays a plain
 * fact — never praise, never blame.
 */
export const getPaceSentenceKey = ({
	kind,
	weekChange,
	planPaceKgPerWeek,
	isAlongPlan,
}: PaceInput): PaceSentenceKey | null => {
	if (weekChange === null) return null
	if (Math.abs(weekChange) < PACE_STEADY_THRESHOLD_KG) return `measurement.pace.steady.${kind}`
	const direction = weekChange < 0 ? 'down' : 'up'
	const comparison: PaceComparison =
		kind === 'WEIGHT' && planPaceKgPerWeek !== null && isAlongPlan
			? compareWithPlan(weekChange, planPaceKgPerWeek)
			: 'plain'
	return `measurement.pace.${direction}.${comparison}`
}

/** The sentence for a key: the unit goes with the number («0,4 кг», «1 см»). */
export const formatPaceSentence = (
	t: TFunction,
	key: PaceSentenceKey,
	amount: number,
	kind: MeasurementKind,
): string => t(key, { value: formatMeasurement(Math.abs(amount), kind, t) })
