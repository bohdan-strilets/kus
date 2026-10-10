import { queryOptions } from '@tanstack/react-query'

import { isRetriableError } from '@/shared/api'

import { postGoalsPreview } from '../api/post-goals-preview'
import { isProfileIncompleteError } from '../lib/is-profile-incomplete-error'

// Under the profile key so that a profile invalidation refreshes the preview. Written out here,
// not imported from entities/profile: entities stay independent of each other.
export const GOALS_PREVIEW_QUERY_KEY = ['profile', 'goals-preview'] as const

/** Always recalculated on open: it is a «what if» over data that may have just changed. */
export const goalsPreviewQueryOptions = queryOptions({
	queryKey: GOALS_PREVIEW_QUERY_KEY,
	queryFn: postGoalsPreview,
	staleTime: 0,
	retry: (_failureCount, error) => !isProfileIncompleteError(error) && isRetriableError(error),
})
