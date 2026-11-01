import type { ProgramResponse, ProgramVersionListResponse } from '@kus/shared'
import {
	type QueryClient,
	queryOptions,
	useQuery,
	type UseQueryResult,
} from '@tanstack/react-query'

import { getActiveProgram } from '../api/get-active-program'
import { getProgramVersions } from '../api/get-program-versions'

/** Every program read lives under this key: a mutation or a workout in the chat refreshes them all. */
export const PROGRAM_QUERY_KEY = ['program'] as const

/** The «next» template moves with the workouts, which invalidate it; otherwise a minute is fresh. */
const PROGRAM_STALE_TIME_MS = 60_000

export const activeProgramQueryOptions = queryOptions({
	queryKey: [...PROGRAM_QUERY_KEY, 'active'],
	queryFn: getActiveProgram,
	staleTime: PROGRAM_STALE_TIME_MS,
})

export const programVersionsQueryOptions = queryOptions({
	queryKey: [...PROGRAM_QUERY_KEY, 'versions'],
	queryFn: getProgramVersions,
	staleTime: PROGRAM_STALE_TIME_MS,
})

export const useActiveProgram = (): UseQueryResult<ProgramResponse | null> =>
	useQuery(activeProgramQueryOptions)

/** The versions are read when the list is opened, not with the screen. */
export const useProgramVersions = ({
	enabled = true,
}: { enabled?: boolean } = {}): UseQueryResult<ProgramVersionListResponse> =>
	useQuery({ ...programVersionsQueryOptions, enabled })

/** A mutation returned the whole program: the screen shows it at once, the versions are read again. */
export const setActiveProgram = (
	queryClient: QueryClient,
	program: ProgramResponse | null,
): void => {
	queryClient.setQueryData(activeProgramQueryOptions.queryKey, program)
	void queryClient.invalidateQueries({ queryKey: programVersionsQueryOptions.queryKey })
}
