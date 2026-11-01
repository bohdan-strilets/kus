import type { ProgramLastSet } from '@kus/shared'
import type { TFunction } from 'i18next'

import { type FormattedSets, formatSets } from './format-sets'

/**
 * The last result of an exercise in the notation of the sets («50×12 ×3»): the working sets only —
 * a warm-up says nothing about what to lift next. Null when the user never did the exercise.
 */
export const formatLastSets = (
	lastSets: readonly ProgramLastSet[] | null,
	t: TFunction,
): FormattedSets | null => {
	if (lastSets === null) return null
	const sets = lastSets
		.filter((set) => !set.isWarmup)
		.map(({ reps, weightKg }) => ({
			reps,
			weightKg,
			durationSec: null,
			distanceM: null,
			isWarmup: false,
		}))
	const formatted = formatSets(
		{ kind: 'STRENGTH', sets, record: null, durationMin: null, distanceM: null },
		t,
	)
	return formatted.segments.length > 0 ? formatted : null
}
