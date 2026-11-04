import type { TFunction } from 'i18next'

import { formatNumber } from '@/entities/workout'
import { formatInteger } from '@/shared/lib'

import type { LiveDraftSet } from './live-draft.types'

const SECONDS_IN_MINUTE = 60

/** «0:56», «1:30»: the minutes are not padded, the seconds are. */
export const formatRestTime = (totalSec: number): string => {
	const safeSec = Math.max(0, Math.floor(totalSec))
	const seconds = safeSec % SECONDS_IN_MINUTE
	return `${Math.floor(safeSec / SECONDS_IN_MINUTE)}:${String(seconds).padStart(2, '0')}`
}

/** «52,5 кг × 12 повт.», «15 повт.», «45 с» — the set after «Далі»; one notation for every variant. */
export const formatRestSet = (set: LiveDraftSet, t: TFunction): string => {
	if (set.reps === null)
		return set.durationSec === null
			? ''
			: t('workout.sec', { value: formatInteger(set.durationSec) })
	const reps = formatInteger(set.reps)
	if (set.weightKg === null || set.weightKg <= 0) return t('workout.reps', { value: reps })
	const weighted = t('workout.setWeightReps', { weight: formatNumber(set.weightKg), reps })
	return `${weighted} ${t('workout.repsUnit')}`
}
