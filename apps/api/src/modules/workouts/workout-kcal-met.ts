import type { CardioType } from '@kus/shared'

import {
	BIKE_MET,
	ELLIPTICAL_MET,
	type MetEntry,
	OTHER_CARDIO_MET,
	ROPE_MET,
	ROW_MET,
	RUN_FAST_MIN_KMH,
	RUN_MET_FAST,
	RUN_MET_MEDIUM,
	RUN_MET_SLOW,
	RUN_MET_UNKNOWN,
	RUN_SLOW_MAX_KMH,
	STAIRS_MET,
	SWIM_MET,
	WALK_MET_FAST,
	WALK_MET_SLOW,
	WALK_MET_TREADMILL_FAST,
	WALK_MET_TREADMILL_SLOW,
	WALK_SLOW_MAX_KMH,
} from './workout-kcal.constants'

const getRunMet = (speedKmh: number | null): MetEntry => {
	if (speedKmh === null) return RUN_MET_UNKNOWN
	if (speedKmh < RUN_SLOW_MAX_KMH) return RUN_MET_SLOW
	if (speedKmh <= RUN_FAST_MIN_KMH) return RUN_MET_MEDIUM
	return RUN_MET_FAST
}

const getWalkMet = (speedKmh: number | null, isTreadmill: boolean): MetEntry => {
	const isSlow = speedKmh === null || speedKmh <= WALK_SLOW_MAX_KMH
	if (isTreadmill) return isSlow ? WALK_MET_TREADMILL_SLOW : WALK_MET_TREADMILL_FAST
	return isSlow ? WALK_MET_SLOW : WALK_MET_FAST
}

const FIXED_CARDIO_MET: Readonly<Record<Exclude<CardioType, 'RUN' | 'WALK'>, MetEntry>> = {
	BIKE: BIKE_MET,
	ROW: ROW_MET,
	ELLIPTICAL: ELLIPTICAL_MET,
	STAIRS: STAIRS_MET,
	ROPE: ROPE_MET,
	SWIM: SWIM_MET,
	OTHER: OTHER_CARDIO_MET,
}

/** The MET of a cardio kind; the speed (km/h) matters for a run and a walk, null = unknown. */
export const getCardioMet = ({
	type,
	speedKmh,
	isTreadmill,
}: {
	type: CardioType
	speedKmh: number | null
	isTreadmill: boolean
}): MetEntry => {
	if (type === 'RUN') return getRunMet(speedKmh)
	if (type === 'WALK') return getWalkMet(speedKmh, isTreadmill)
	return FIXED_CARDIO_MET[type]
}
