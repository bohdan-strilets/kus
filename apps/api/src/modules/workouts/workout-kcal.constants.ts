import { DEFAULT_REST_SEC, WORK_SEC_PER_SET } from '@kus/shared'

/**
 * MET values of the workout calorie estimate. Source: Herrmann SD et al., 2024 Adult Compendium of
 * Physical Activities, J Sport Health Sci 2024;13(1):6-12 (https://pacompendium.com). Each entry
 * carries the Compendium code; the page of the code is in the comment above it.
 */
export interface MetEntry {
	readonly code: string
	readonly met: number
}

// https://pacompendium.com/conditioning-exercise/ — resistance training, multiple exercises, 8–15 reps
export const STRENGTH_MET: MetEntry = { code: '02054', met: 3.5 }
// https://pacompendium.com/conditioning-exercise/ — calisthenics / bodyweight strength
export const BODYWEIGHT_STRENGTH_MET: MetEntry = { code: '02022', met: 3.8 }

// https://pacompendium.com/inactivity/ — resting; the formula subtracts it: (MET − REST_MET)
export const REST_MET = 1.0

// https://pacompendium.com/running/ — by speed, km/h
export const RUN_SLOW_MAX_KMH = 9
export const RUN_FAST_MIN_KMH = 10.5
export const RUN_MET_SLOW: MetEntry = { code: '12030', met: 8.5 }
export const RUN_MET_MEDIUM: MetEntry = { code: '12050', met: 9.3 }
export const RUN_MET_FAST: MetEntry = { code: '12070', met: 11.0 }
export const RUN_MET_UNKNOWN: MetEntry = { code: '12150', met: 8.0 }

// https://pacompendium.com/walking/ — by speed, km/h
export const WALK_SLOW_MAX_KMH = 5.5
export const WALK_MET_SLOW: MetEntry = { code: '17190', met: 3.8 }
export const WALK_MET_FAST: MetEntry = { code: '17220', met: 5.5 }
export const WALK_MET_TREADMILL_SLOW: MetEntry = { code: '17355', met: 3.8 }
export const WALK_MET_TREADMILL_FAST: MetEntry = { code: '17361', met: 5.8 }

// https://pacompendium.com/bicycling/ — stationary bike, no intensity data (not 01200)
export const BIKE_MET: MetEntry = { code: '01216', met: 5.0 }

// https://pacompendium.com/conditioning-exercise/
export const ROW_MET: MetEntry = { code: '02071', met: 5.0 }
export const ELLIPTICAL_MET: MetEntry = { code: '02048', met: 5.0 }
export const STAIRS_MET: MetEntry = { code: '02065', met: 9.3 }
export const ROPE_MET: MetEntry = { code: '02068', met: 11.0 }

// https://pacompendium.com/water-activities/
export const SWIM_MET: MetEntry = { code: '18292', met: 5.8 }

/**
 * Not a Compendium row: a conservative fallback so that an unknown cardio is not inflated.
 * The author's decision (plan 0.10.3).
 */
export const OTHER_CARDIO_MET: MetEntry = { code: 'fallback', met: 5.0 }

export const ROUND_KCAL_TO = 10

/** One working set with its rest: 45 s of work and the default rest (the template estimate's numbers). */
export const STRENGTH_MIN_PER_SET = (WORK_SEC_PER_SET + DEFAULT_REST_SEC) / 60

/** min per km, to know the time of a cardio told by its distance only. */
export const DEFAULT_CARDIO_PACE_MIN_PER_KM = {
	RUN: 6,
	WALK: 12,
	BIKE: 3,
	ROW: 5,
} as const
