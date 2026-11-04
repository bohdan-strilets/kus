import type { TFunction } from 'i18next'

import { formatSets } from '@/entities/workout'

import type { LiveDraftExercise, LiveDraftSet } from './live-draft.types'

const SECONDS_IN_MINUTE = 60

/** «0:56», «1:30»: the minutes are not padded, the seconds are. */
export const formatRestTime = (totalSec: number): string => {
	const safeSec = Math.max(0, Math.floor(totalSec))
	const seconds = safeSec % SECONDS_IN_MINUTE
	return `${Math.floor(safeSec / SECONDS_IN_MINUTE)}:${String(seconds).padStart(2, '0')}`
}

/** «52,5 кг × 12», «15 повт.» — the set in the notation of the app. */
export const formatRestSet = (
	exercise: Pick<LiveDraftExercise, 'kind'>,
	set: LiveDraftSet,
	t: TFunction,
): string =>
	formatSets(
		{ kind: exercise.kind, sets: [set], record: null, durationMin: null, distanceM: null },
		t,
	).segments[0]?.text ?? ''
