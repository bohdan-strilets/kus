import {
	type LiveExerciseInput,
	liveExerciseInputSchema,
	type LiveWorkoutResponse,
	liveWorkoutResponseSchema,
} from '@kus/shared'
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
	/**
	 * The owner's account awaits deletion (as the API last said). Kept so an offline cold start never
	 * opens the live screen of such an account; goes with the owner.
	 */
	pendingDeletion: boolean
	/** By `workoutId`. */
	snapshots: Record<string, UnsentSnapshot>
	/**
	 * The last answer of the API about the open session (GET current, PUT): what an offline cold
	 * start shows. Belongs to `ownerId`, goes with it, and with the session itself.
	 */
	lastSeen: LiveWorkoutResponse | null
	claim: (userId: string | null) => void
	/** Only for a known owner. */
	setPendingDeletion: (isPending: boolean) => void
	/** False when the browser refused to keep it (quota): the copy in memory is still there. */
	saveSnapshot: (workoutId: string, snapshot: UnsentSnapshot) => boolean
	/** Only after the server took it, or when the session is closed, discarded or deleted. */
	clearSnapshot: (workoutId: string) => void
	setLastSeen: (live: LiveWorkoutResponse) => void
	clearLastSeen: () => void
}

export const LIVE_WORKOUT_STORAGE_KEY = 'kusik-live-workout'
const LIVE_WORKOUT_STORAGE_VERSION = 4
/** The last version that had no `lastSeen`: its snapshots are still good. */
const STORAGE_VERSION_WITHOUT_LAST_SEEN = 2
/** The last version that had no `pendingDeletion`: owner, snapshots and `lastSeen` are still good. */
const STORAGE_VERSION_WITHOUT_PENDING_DELETION = 3
/** A few at most exist (one session is open at a time); the oldest go if something stale piles up. */
export const SNAPSHOTS_MAX = 5

const storedSnapshotSchema = z.object({
	exercises: z.array(liveExerciseInputSchema),
	knownEditedAt: z.iso.datetime().nullable(),
})

const storedStateSchema = z.object({
	ownerId: z.uuid().nullable().catch(null),
	snapshots: z.record(z.uuid(), z.unknown()),
	lastSeen: z.unknown().optional(),
	pendingDeletion: z.unknown().optional(),
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

/** Only an explicit `true` of a known owner counts; anything else reads as «not pending». */
export const restorePendingDeletion = (stored: unknown): boolean => {
	const state = storedStateSchema.safeParse(stored)
	return state.success && state.data.ownerId !== null && state.data.pendingDeletion === true
}

/** The stored last answer, or null when it does not parse or has no owner to belong to. */
export const restoreLastSeen = (stored: unknown): LiveWorkoutResponse | null => {
	const state = storedStateSchema.safeParse(stored)
	if (!state.success || state.data.ownerId === null) return null
	const parsed = liveWorkoutResponseSchema.safeParse(state.data.lastSeen)
	return parsed.success ? parsed.data : null
}

/**
 * Outside React so a snapshot is kept when the screen unmounts or the PWA is killed mid-set. It is
 * written before the request goes out and leaves only when the server has it.
 */
export const useLiveWorkoutStore = create<LiveWorkoutState>()(
	persist(
		(set) => ({
			ownerId: null,
			pendingDeletion: false,
			snapshots: {},
			lastSeen: null,
			claim: (userId) => {
				set((state) =>
					state.ownerId === userId
						? state
						: { ownerId: userId, pendingDeletion: false, snapshots: {}, lastSeen: null },
				)
			},
			setPendingDeletion: (isPending) => {
				set((state) =>
					state.ownerId === null || state.pendingDeletion === isPending
						? state
						: { pendingDeletion: isPending },
				)
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
			setLastSeen: (live) => {
				// nobody's copy is never kept: without a known owner it could be shown to anyone
				set((state) => (state.ownerId === null ? state : { lastSeen: live }))
			},
			clearLastSeen: () => {
				set((state) => (state.lastSeen === null ? state : { lastSeen: null }))
			},
		}),
		{
			name: LIVE_WORKOUT_STORAGE_KEY,
			version: LIVE_WORKOUT_STORAGE_VERSION,
			storage: createJSONStorage(() => localStorage),
			partialize: ({ ownerId, pendingDeletion, snapshots, lastSeen }) => ({
				ownerId,
				pendingDeletion,
				snapshots,
				lastSeen,
			}),
			// v2 held the same owner and snapshots, only no `lastSeen`; v3 also had `lastSeen`, only no
			// `pendingDeletion`; anything older or broken is dropped: it holds only what was about to be sent again
			migrate: (stored, version) => {
				if (version === STORAGE_VERSION_WITHOUT_PENDING_DELETION) {
					return {
						ownerId: restoreOwnerId(stored),
						pendingDeletion: false,
						snapshots: restoreSnapshots(stored),
						lastSeen: restoreLastSeen(stored),
					}
				}
				if (version === STORAGE_VERSION_WITHOUT_LAST_SEEN) {
					return {
						ownerId: restoreOwnerId(stored),
						pendingDeletion: false,
						snapshots: restoreSnapshots(stored),
						lastSeen: null,
					}
				}
				return { ownerId: null, pendingDeletion: false, snapshots: {}, lastSeen: null }
			},
			merge: (stored, current) => {
				const ownerId = current.ownerId ?? restoreOwnerId(stored)
				// a copy written for another owner than the one in charge now is never taken
				const isSameOwner = restoreOwnerId(stored) === ownerId
				return {
					...current,
					ownerId,
					pendingDeletion:
						current.pendingDeletion || (isSameOwner && restorePendingDeletion(stored)),
					// what is in memory wins: a set may have been marked before the storage was read
					snapshots: { ...restoreSnapshots(stored), ...current.snapshots },
					lastSeen: current.lastSeen ?? (isSameOwner ? restoreLastSeen(stored) : null),
				}
			},
		},
	),
)

/** The snapshot of one session that never reached the server, for the draft to start from. */
export const useUnsentSnapshot = (workoutId: string | null): UnsentSnapshot | null =>
	useLiveWorkoutStore((state) => (workoutId === null ? null : (state.snapshots[workoutId] ?? null)))

/** The last open session the server showed this device, or null; for an offline cold start. */
export const useLastSeenLive = (): LiveWorkoutResponse | null =>
	useLiveWorkoutStore((state) => state.lastSeen)

/**
 * This device holds the last live session of its last known user, and that user's account does not
 * await deletion: the live screen may render from it while the session check is pending or offline.
 */
export const useHasOfflineLive = (): boolean =>
	useLiveWorkoutStore(
		(state) => state.ownerId !== null && state.lastSeen !== null && !state.pendingDeletion,
	)

/** The user the stored session and snapshots belong to: it changes in the same step that drops them. */
export const useLiveOwnerId = (): string | null => useLiveWorkoutStore((state) => state.ownerId)
