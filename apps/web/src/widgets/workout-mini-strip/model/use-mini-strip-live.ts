import type { LiveWorkoutResponse } from '@kus/shared'
import { useQuery } from '@tanstack/react-query'

import { liveWorkoutQueryOptions } from '@/entities/workout'
import { FEATURES } from '@/shared/config'

/** The open live session the strip shows; null when there is none (or the workouts tab is off). */
export const useMiniStripLive = (): LiveWorkoutResponse | null =>
	useQuery({ ...liveWorkoutQueryOptions(), enabled: FEATURES.workouts }).data ?? null
