import type { ActivityLevel } from '@kus/shared'
import type { ParseKeys } from 'i18next'

// entities/profile has the same map; it is repeated because entities don't import each other.
// VERY_ACTIVE exists only in the DB and reads as ACTIVE.
export const ACTIVITY_LABEL_KEY: Record<ActivityLevel, ParseKeys> = {
	SEDENTARY: 'profile.activity.SEDENTARY.label',
	LIGHT: 'profile.activity.LIGHT.label',
	MODERATE: 'profile.activity.MODERATE.label',
	ACTIVE: 'profile.activity.ACTIVE.label',
	VERY_ACTIVE: 'profile.activity.ACTIVE.label',
}
