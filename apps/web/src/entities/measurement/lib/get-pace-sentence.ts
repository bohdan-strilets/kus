import type { MeasurementKind } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatMeasurement } from './format-measurement'

/** A week changed by less than this (after rounding to a tenth) is no change. */
export const PACE_STEADY_THRESHOLD_KG = 0.05

export type PaceSentenceKey =
	`measurement.pace.steady.${MeasurementKind}` | `measurement.pace.${'down' | 'up'}.plain`

export interface PaceInput {
	kind: MeasurementKind
	weekChange: number | null
}

/**
 * The template key of the weekly-pace sentence, shared by the chat card and the «Прогрес» insight:
 * «Мінус {{value}} за тиждень.» A plain fact — no comparison with the plan, no praise, no blame.
 * The number is passed to `t`; the model never writes it.
 */
export const getPaceSentenceKey = ({ kind, weekChange }: PaceInput): PaceSentenceKey | null => {
	if (weekChange === null) return null
	if (Math.abs(weekChange) < PACE_STEADY_THRESHOLD_KG) return `measurement.pace.steady.${kind}`
	return weekChange < 0 ? 'measurement.pace.down.plain' : 'measurement.pace.up.plain'
}

/** The sentence for a key: the unit goes with the number («0,4 кг», «1 см»). */
export const formatPaceSentence = (
	t: TFunction,
	key: PaceSentenceKey,
	amount: number,
	kind: MeasurementKind,
): string => t(key, { value: formatMeasurement(Math.abs(amount), kind, t) })
