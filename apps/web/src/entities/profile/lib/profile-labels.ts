import { type ActivityLevel, type GoalType, PACE_OPTIONS_KG_PER_WEEK, type Sex } from '@kus/shared'
import type { ParseKeys } from 'i18next'

import { formatDecimal, MINUS_SIGN } from '@/shared/lib'

export const PACE_OPTIONS = PACE_OPTIONS_KG_PER_WEEK

export const SEX_LABEL_KEY: Record<Sex, ParseKeys> = {
	MALE: 'profile.sex.MALE',
	FEMALE: 'profile.sex.FEMALE',
}

export const GOAL_TYPE_LABEL_KEY: Record<GoalType, ParseKeys> = {
	LOSE: 'profile.goalType.LOSE',
	MAINTAIN: 'profile.goalType.MAINTAIN',
	GAIN: 'profile.goalType.GAIN',
}

// PATCH accepts four levels; VERY_ACTIVE exists only in the DB, so GET may still return it
// and it reads the same as ACTIVE.
export const ACTIVITY_LABEL_KEY: Record<ActivityLevel, ParseKeys> = {
	SEDENTARY: 'profile.activity.SEDENTARY.label',
	LIGHT: 'profile.activity.LIGHT.label',
	MODERATE: 'profile.activity.MODERATE.label',
	ACTIVE: 'profile.activity.ACTIVE.label',
	VERY_ACTIVE: 'profile.activity.ACTIVE.label',
}

export const ACTIVITY_HINT_KEY: Record<ActivityLevel, ParseKeys> = {
	SEDENTARY: 'profile.activity.SEDENTARY.hint',
	LIGHT: 'profile.activity.LIGHT.hint',
	MODERATE: 'profile.activity.MODERATE.hint',
	ACTIVE: 'profile.activity.ACTIVE.hint',
	VERY_ACTIVE: 'profile.activity.ACTIVE.hint',
}

const PACE_HINT_KEYS: Record<'LOSE' | 'GAIN', Record<number, ParseKeys>> = {
	LOSE: {
		0.25: 'profile.pace.lose.p025',
		0.5: 'profile.pace.lose.p05',
		0.75: 'profile.pace.lose.p075',
	},
	GAIN: {
		0.25: 'profile.pace.gain.p025',
		0.5: 'profile.pace.gain.p05',
		0.75: 'profile.pace.gain.p075',
	},
}

/** The hint under a pace option; MAINTAIN has no pace. */
export const getPaceHintKey = (goalType: GoalType, pace: number): ParseKeys | null => {
	if (goalType === 'MAINTAIN') return null
	return PACE_HINT_KEYS[goalType][pace] ?? null
}

const HALF_KG = 0.5

/** «−0,25» / «+0,5»; MAINTAIN has no sign. */
export const formatPace = (pace: number, goalType: GoalType): string => {
	const formatted = formatDecimal(pace, pace % HALF_KG === 0 ? 1 : 2)
	if (goalType === 'LOSE') return `${MINUS_SIGN}${formatted}`
	if (goalType === 'GAIN') return `+${formatted}`
	return formatted
}
