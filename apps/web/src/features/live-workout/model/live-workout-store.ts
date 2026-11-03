import { type LiveExerciseInput, liveExerciseInputSchema } from '@kus/shared'
import { z } from 'zod'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/** The last state of a live session the server has not confirmed yet. */
export interface UnsentSnapshot {
	exercises: LiveExerciseInput[]
	/** The `editedAt` the person's screen last saw: a chat edit made meanwhile is a 409, not a lost set. */
	knownEditedAt: string | null
}

interface LiveWorkoutState {
	/** The signed-in user the snapshots belong to; another one (or a logout) drops them. */
	ownerId: string | null
	/** By `workoutId`. */
	snapshots: Record<string, UnsentSnapshot>
	claim: (userId: string | null) => void
	/** False when the browser refused to keep it (quota): the copy in memory is still there. */
	saveSnapshot: (workoutId: string, snapshot: UnsentSnapshot) => boolean
	/** Only after the server took it, or when the session is closed, discarded or deleted. */
	clearSnapshot: (workoutId: string) => void
}

export const LIVE_WORKOUT_STORAGE_KEY = 'kusik-live-workout'
const LIVE_WORKOUT_STORAGE_VERSION = 2
/** A few at most exist (one session is open at a time); the oldest go if something stale piles up. */
export const SNAPSHOTS_MAX = 5

const storedSnapshotSchema = z.object({
	exercises: z.array(liveExerciseInputSchema),
	knownEditedAt: z.iso.datetime().nullable(),
})

const storedStateSchema = z.object({
	ownerId: z.uuid().nullable().catch(null),
	snapshots: z.record(z.uuid(), z.unknown()),
})

/** Storage is outside the app's control: what does not parse is dropped, the rest is kept. */
export const restoreSnapshots = (stored: unknown): Record<string, UnsentSnapshot> => {
	const state = storedStateSchema.safeParse(stored)
	if (!state.success) return {}
	return Object.fromEntries(
		Object.entries(state.data.snapshots).flatMap(([workoutId, value]) => {
			const parsed = storedSnapshotSchema.safeParse(value)
			return parsed.success ? [[workoutId, parsed.data] as const] : []
		}),
	)
}

/** The owner written next to the snapshots; anything unreadable counts as nobody's. */
export const restoreOwnerId = (stored: unknown): string | null => {
	const state = storedStateSchema.safeParse(stored)
	return state.success ? state.data.ownerId : null
}

/**
 * Outside React so a snapshot is kept when the screen unmounts or the PWA is killed mid-set. It is
 * written before the request goes out and leaves only when the server has it.
 */
export const useLiveWorkoutStore = create<LiveWorkoutState>()(
	persist(
		(set) => ({
			ownerId: null,
			snapshots: {},
			claim: (userId) => {
				set((state) => (state.ownerId === userId ? state : { ownerId: userId, snapshots: {} }))
			},
			saveSnapshot: (workoutId, snapshot) => {
				try {
					set((state) => {
						const { [workoutId]: _previous, ...others } = state.snapshots
						// re-inserted last, so the oldest are the first to go
						const snapshots = { ...others, [workoutId]: snapshot }
						return {
							snapshots: Object.fromEntries(Object.entries(snapshots).slice(-SNAPSHOTS_MAX)),
						}
					})
					return true
				} catch {
					// the state is set before the storage is written: a full storage costs only the copy on disk
					return false
				}
			},
			clearSnapshot: (workoutId) => {
				set((state) => {
					const { [workoutId]: _removed, ...snapshots } = state.snapshots
					return { snapshots }
				})
			},
		}),
		{
			name: LIVE_WORKOUT_STORAGE_KEY,
			version: LIVE_WORKOUT_STORAGE_VERSION,
			storage: createJSONStorage(() => localStorage),
			partialize: ({ ownerId, snapshots }) => ({ ownerId, snapshots }),
			// an older or broken shape is dropped: it holds only what was about to be sent again
			migrate: () => ({ ownerId: null, snapshots: {} }),
			merge: (stored, current) => ({
				...current,
				ownerId: current.ownerId ?? restoreOwnerId(stored),
				// what is in memory wins: a set may have been marked before the storage was read
				snapshots: { ...restoreSnapshots(stored), ...current.snapshots },
			}),
		},
	),
)

/** The snapshot of one session that never reached the server, for the draft to start from. */
export const useUnsentSnapshot = (workoutId: string | null): UnsentSnapshot | null =>
	useLiveWorkoutStore((state) => (workoutId === null ? null : (state.snapshots[workoutId] ?? null)))
