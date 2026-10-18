import type { ProgressResponse } from '@kus/shared'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { useLocalToday } from '@/entities/day'
import { useSessionUser } from '@/entities/session'

import { progressQueryOptions } from './progress-query'
import type { ProgressRange } from './progress.types'

export const useProgress = (range: ProgressRange): UseQueryResult<ProgressResponse> => {
	const user = useSessionUser()
	// the screen renders only for a signed-in user; the zone is a fallback for the types
	const today = useLocalToday(user?.timezone ?? 'UTC')
	return useQuery(progressQueryOptions(range, today))
}
