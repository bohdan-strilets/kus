import { type FoodParseDecision, getMeasurementDay } from '@kus/shared'

import type { MeasuredItem } from './eval.types.js'

/** The measurements of a valid answer with their resolved day; only `log` and `reply` carry them. */
export const getMeasuredItems = (decision: FoodParseDecision, today: string): MeasuredItem[] => {
	if (decision.kind !== 'log' && decision.kind !== 'reply') return []
	return decision.measurements.map((input) => ({
		kind: input.kind,
		value: input.value,
		date: getMeasurementDay(input, today),
		confirmedJump: input.confirmedJump,
	}))
}
