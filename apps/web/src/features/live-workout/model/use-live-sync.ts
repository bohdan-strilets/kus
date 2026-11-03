import type { LiveExerciseInput } from '@kus/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
	liveWorkoutQueryOptions,
	putLiveWorkout,
	setLiveWorkout,
	WORKOUTS_QUERY_KEY,
} from '@/entities/workout'

import {
	createLiveSync,
	type LiveSync,
	type LiveSyncState,
	type LiveSyncStatus,
} from './create-live-sync'
import { useLiveWorkoutStore } from './live-workout-store'

const IDLE_STATE: LiveSyncState = { status: 'idle', closedByChat: false }

export interface UseLiveSync extends LiveSyncState {
	/** Call with the whole live part of the draft after every change. */
	schedule: (exercises: LiveExerciseInput[]) => void
	/** «Повторити» after an error; the connection coming back does it by itself. */
	retry: () => void
	/** Resolves `idle` once everything is on the server, or `offline` / `error` when it is stuck. */
	whenIdle: () => Promise<LiveSyncStatus>
}

/**
 * The live screen's link to the server: see `createLiveSync`. Unsent sets stay in the store, so a
 * screen that opens again (or a PWA started anew) sends them first. A 409 EDITED re-reads the
 * session into the cache (`useLiveWorkout` shows the chat's exercises; `adoptServerExercises`
 * brings them into the draft); a 409 FINISHED, or a session that is gone, sets `closedByChat`.
 */
export const useLiveSync = ({
	workoutId,
	initialEditedAt,
}: {
	workoutId: string
	initialEditedAt: string | null
}): UseLiveSync => {
	const queryClient = useQueryClient()
	const [state, setState] = useState<LiveSyncState>(IDLE_STATE)
	const syncRef = useRef<LiveSync | null>(null)
	// the first value is all the engine needs: the later ones come from its own answers
	const initialEditedAtRef = useRef(initialEditedAt)

	useEffect(() => {
		const { saveSnapshot, clearSnapshot } = useLiveWorkoutStore.getState()
		const sync = createLiveSync({
			workoutId,
			initialEditedAt: initialEditedAtRef.current,
			store: {
				read: () => useLiveWorkoutStore.getState().snapshots[workoutId] ?? null,
				save: (snapshot) => saveSnapshot(workoutId, snapshot),
				clear: () => {
					clearSnapshot(workoutId)
				},
			},
			put: (update) => putLiveWorkout({ workoutId, update }),
			refetchCurrent: () => queryClient.query({ ...liveWorkoutQueryOptions(), staleTime: 0 }),
			onSynced: (live) => {
				setLiveWorkout(queryClient, live)
			},
			onClosed: () => {
				setLiveWorkout(queryClient, null)
				void queryClient.invalidateQueries({ queryKey: WORKOUTS_QUERY_KEY })
			},
			onChange: setState,
		})
		syncRef.current = sync
		const handleOnline = (): void => {
			sync.retry()
		}
		window.addEventListener('online', handleOnline)
		return () => {
			window.removeEventListener('online', handleOnline)
			sync.dispose()
			syncRef.current = null
		}
	}, [workoutId, queryClient])

	const schedule = useCallback((exercises: LiveExerciseInput[]): void => {
		syncRef.current?.schedule(exercises)
	}, [])
	const retry = useCallback((): void => {
		syncRef.current?.retry()
	}, [])

	const whenIdle = useCallback(
		(): Promise<LiveSyncStatus> => syncRef.current?.whenIdle() ?? Promise.resolve('idle'),
		[],
	)

	return { ...state, schedule, retry, whenIdle }
}
