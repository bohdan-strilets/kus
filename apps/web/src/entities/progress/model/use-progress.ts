import type { ProgressResponse } from '@kus/shared'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { progressQueryOptions } from './progress-query'
import type { ProgressRange } from './progress.types'

export const useProgress = (range: ProgressRange): UseQueryResult<ProgressResponse> =>
	useQuery(progressQueryOptions(range))
