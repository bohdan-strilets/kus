import type { LiveExerciseInput, LiveWorkoutResponse, LiveWorkoutUpdate } from '@kus/shared'

import { LiveWorkoutConflictError } from '@/entities/workout'
import { getApiError, HTTP_STATUS, isRetriableError } from '@/shared/api'

import { mergeServerInputs } from '../lib/merge-server-inputs'
import type { UnsentSnapshot } from './live-workout-store'

export type LiveSyncStatus = 'idle' | 'saving' | 'offline' | 'error'

export interface LiveSyncState {
	status: LiveSyncStatus
	/** The chat finished or removed the session: nothing more is written, the screen says so. */
	closedByChat: boolean
}

export interface LiveSyncStore {
	read: () => UnsentSnapshot | null
	/** False when the browser could not keep it: the sync goes on from memory. */
	save: (snapshot: UnsentSnapshot) => boolean
	clear: () => void
}

export interface LiveSyncOptions {
	workoutId: string
	/** `editedAt` of the session as the screen read it. */
	initialEditedAt: string | null
	store: LiveSyncStore
	put: (update: LiveWorkoutUpdate) => Promise<LiveWorkoutResponse>
	refetchCurrent: () => Promise<LiveWorkoutResponse | null>
	/** An answer of the server (a PUT or the re-read after a 409): into the cache. */
	onSynced: (live: LiveWorkoutResponse) => void
	/** The session is closed (by the chat or gone): caches are refreshed. */
	onClosed: () => void
	onChange: (state: LiveSyncState) => void
}

export interface LiveSync {
	/** The newest state of the live part; it is stored at once and sent as soon as nothing is in flight. */
	schedule: (exercises: LiveExerciseInput[]) => void
	/** Sends what is waiting now: the connection is back or the person tapped «повторити». */
	retry: () => void
	/**
	 * Resolves when nothing is in flight and nothing unsent is left (`idle`), or at once with
	 * `offline` / `error` when the sets are stuck: the caller decides what to tell the person.
	 */
	whenIdle: () => Promise<LiveSyncStatus>
	dispose: () => void
}

export const RETRY_BASE_MS = 1_000
export const RETRY_MAX_MS = 30_000
/** Several 409 EDITED in a row mean the chat keeps rewriting the session: stop and show the error. */
export const CONFLICT_RETRIES_MAX = 3

/**
 * One PUT at a time, the newest snapshot wins (what is scheduled while a request is in flight is
 * sent right after it), network and 5xx failures retry with a growing pause, a 4xx stops. The
 * snapshot stays in the store until the server confirms it, so nothing is lost silently.
 */
export const createLiveSync = (options: LiveSyncOptions): LiveSync => {
	const { workoutId, store, put, refetchCurrent, onSynced, onClosed, onChange } = options
	const stored = store.read()
	let knownEditedAt = stored?.knownEditedAt ?? options.initialEditedAt
	let pending: LiveExerciseInput[] | null = stored?.exercises ?? null
	let isInFlight = false
	let isClosed = false
	let isDisposed = false
	let attempt = 0
	let conflicts = 0
	let timer: ReturnType<typeof setTimeout> | null = null
	let state: LiveSyncState = { status: 'idle', closedByChat: false }
	let waiters: ((status: LiveSyncStatus) => void)[] = []

	const settleWaiters = (): void => {
		const isDone = !isInFlight && pending === null
		const isStuck = state.status === 'offline' || state.status === 'error'
		if (!isDone && !isStuck) return
		const status = isDone && !isStuck ? 'idle' : state.status
		const resolving = waiters
		waiters = []
		resolving.forEach((resolve) => {
			resolve(status)
		})
	}

	const emit = (next: Partial<LiveSyncState>): void => {
		state = { ...state, ...next }
		if (!isDisposed) onChange(state)
		settleWaiters()
	}
	// read through calls, so a flag set while a request was awaited is not taken for the old value
	const isActive = (): boolean => !isClosed && !isDisposed
	const takePending = (): LiveExerciseInput[] | null => {
		const taken = pending
		pending = null
		return taken
	}
	const clearTimer = (): void => {
		if (timer !== null) clearTimeout(timer)
		timer = null
	}
	const persist = (): void => {
		// a disposed engine must not write over the snapshot of the screen that replaced it
		if (isDisposed) return
		if (pending) store.save({ exercises: pending, knownEditedAt })
		else store.clear()
	}
	const close = (): void => {
		isClosed = true
		pending = null
		clearTimer()
		store.clear()
		onClosed()
		emit({ status: 'idle', closedByChat: true })
	}

	const scheduleRetry = (status: LiveSyncStatus): void => {
		if (isDisposed) return
		emit({ status })
		const delay = Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS)
		attempt += 1
		timer = setTimeout(() => {
			timer = null
			void flush()
		}, delay)
	}

	/** The chat replaced the session: read it, take its exercises, send ours again on top. */
	const handleEdited = async (): Promise<boolean> => {
		conflicts += 1
		// the re-read comes first even at the limit: the next send needs the newest `editedAt`
		const fresh = await refetchCurrent()
		if (isDisposed) return false
		if (fresh?.workout.id !== workoutId) {
			close()
			return false
		}
		knownEditedAt = fresh.editedAt
		// the chat kept the keys of what it rewrote: its values win over the unsent ones, which would
		// otherwise bring the old numbers back with the next PUT
		if (pending !== null) pending = mergeServerInputs(pending, fresh.workout.exercises)
		onSynced(fresh)
		persist()
		if (conflicts > CONFLICT_RETRIES_MAX) {
			conflicts = 0
			emit({ status: 'error' })
			return false
		}
		return true
	}

	/** Returns true when the loop may send again at once. */
	const handleFailure = async (error: unknown): Promise<boolean> => {
		if (error instanceof LiveWorkoutConflictError) {
			if (error.reason === 'EDITED') return handleEdited()
			close()
			return false
		}
		const apiError = getApiError(error)
		if (apiError.kind === 'http' && apiError.status === HTTP_STATUS.notFound) {
			close()
			return false
		}
		if (isRetriableError(error)) scheduleRetry(apiError.kind === 'network' ? 'offline' : 'error')
		else emit({ status: 'error' })
		return false
	}

	const flush = async (): Promise<void> => {
		if (isInFlight || !isActive()) return
		isInFlight = true
		clearTimer()
		try {
			let isGoing = true
			while (isGoing && isActive()) {
				const sending = takePending()
				if (sending === null) break
				emit({ status: 'saving' })
				try {
					const live = await put({ knownEditedAt, exercises: sending })
					if (isDisposed) break
					knownEditedAt = live.editedAt
					attempt = 0
					conflicts = 0
					onSynced(live)
					persist()
				} catch (error) {
					if (isDisposed) break
					// the newest wins; when nothing newer came, the failed one is kept to try again
					pending ??= sending
					isGoing = await handleFailure(error).catch((cause: unknown) => {
						// the re-read after a 409 failed too: keep what is stored and try again later
						scheduleRetry(isRetriableError(cause) ? 'offline' : 'error')
						return false
					})
				}
			}
		} finally {
			isInFlight = false
		}
		if (!isClosed && !isDisposed && pending === null) emit({ status: 'idle' })
		settleWaiters()
	}

	if (pending) void flush()

	return {
		schedule: (exercises) => {
			if (isClosed || isDisposed) return
			pending = exercises
			persist()
			if (!isInFlight && timer === null) void flush()
		},
		retry: () => {
			if (pending === null || isInFlight) return
			attempt = 0
			void flush()
		},
		whenIdle: () =>
			new Promise((resolve) => {
				waiters.push(resolve)
				settleWaiters()
			}),
		dispose: () => {
			isDisposed = true
			clearTimer()
			settleWaiters()
		},
	}
}
