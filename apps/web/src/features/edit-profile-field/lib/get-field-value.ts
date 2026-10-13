import type { ProfileResponse } from '@kus/shared'

import type { ProfileFieldKey } from '@/entities/profile'

/** The saved value of the field; weight and waist live in the latest measurements. null — not set yet. */
export const getFieldValue = (
	profile: ProfileResponse,
	field: ProfileFieldKey,
): string | number | null => {
	if (field === 'weightKg') return profile.weight?.kg ?? null
	if (field === 'waistCm') return profile.waist?.cm ?? null
	const value = profile.profile[field]
	// PATCH has no VERY_ACTIVE: it reads and edits as ACTIVE
	return value === 'VERY_ACTIVE' ? 'ACTIVE' : value
}
