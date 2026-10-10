import { queryOptions } from '@tanstack/react-query'

import { getProfile } from '../api/get-profile'

/** The goals preview lives under this key too: whatever refreshes the profile refreshes it. */
export const PROFILE_QUERY_KEY = ['profile'] as const

export const profileQueryOptions = queryOptions({
	queryKey: PROFILE_QUERY_KEY,
	queryFn: getProfile,
})
