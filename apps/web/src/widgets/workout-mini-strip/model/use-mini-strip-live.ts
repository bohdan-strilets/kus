import type { LiveWorkoutResponse } from '@kus/shared'
import { onlineManager, useQuery } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

import { liveWorkoutQueryOptions } from '@/entities/workout'
import { getApiError } from '@/shared/api'
import { FEATURES } from '@/shared/config'

/** The open live session the strip shows; null when there is none (or the workouts tab is off). */
export const useMiniStripLive = (): LiveWorkoutResponse | null =>
	useQuery({ ...liveWorkoutQueryOptions(), enabled: FEATURES.workouts }).data ?? null

const subscribeOnline = (onChange: () => void): (() => void) => onlineManager.subscribe(onChange)
const getIsOnline = (): boolean => onlineManager.isOnline()

/**
 * The strip is «без мережі»: the browser reports no connection, or the last live request failed
 * without an answer of the API. No polling: it follows the online manager and the query it shares.
 */
export const useMiniStripOffline = (): boolean => {
	const isOnline = useSyncExternalStore(subscribeOnline, getIsOnline)
	const query = useQuery({ ...liveWorkoutQueryOptions(), enabled: FEATURES.workouts })
	return !isOnline || (query.isError && getApiError(query.error).kind === 'network')
}
