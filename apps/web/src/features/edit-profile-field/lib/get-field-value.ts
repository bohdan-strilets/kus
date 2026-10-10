import type { ProfileResponse } from '@kus/shared'

import type { ProfileFieldKey } from '@/entities/profile'

/** The saved value of the field; weight lives in the latest weigh-in. null — not set yet. */
export const getFieldValue = (
	profile: ProfileResponse,
	field: ProfileFieldKey,
): string | number | null => {
	if (field === 'weightKg') return profile.weight?.kg ?? null
	const value = profile.profile[field]
	// PATCH has no VERY_ACTIVE: it reads and edits as ACTIVE
	return value === 'VERY_ACTIVE' ? 'ACTIVE' : value
}
