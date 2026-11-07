import { type AuthUser, liveWorkoutResponseSchema } from '@kus/shared'
import { hashKey, type QueryCacheNotifyEvent, type QueryClient } from '@tanstack/react-query'

import { useFreshReplyStore } from '@/entities/message'
import { SESSION_QUERY_KEY } from '@/entities/session'
import { useGoalCelebrationStore } from '@/entities/stats'
import { LIVE_WORKOUT_QUERY_KEY } from '@/entities/workout'
import { useLiveWorkoutStore } from '@/features/live-workout'
import {
	useComposerDraftStore,
	useOutboxStore,
	usePhotoDraftStore,
	usePhotoLimitStore,
	usePhotoSessionStore,
} from '@/features/send-message'

const SESSION_HASH = hashKey(SESSION_QUERY_KEY)
const LIVE_HASH = hashKey(LIVE_WORKOUT_QUERY_KEY)

/**
 * Unsent messages, the text and the photo in the composer and the pictures of sent messages and the unsent sets of a live workout
 * belong to the user who typed them: a login as someone else, a logout or a dead refresh drops
 * them from memory and storage, so they are never shown or sent from another account.
 */
export const syncOutboxOwner = (queryClient: QueryClient): (() => void) => {
	const claim = (): void => {
		const user = queryClient.getQueryData<AuthUser | null>(SESSION_QUERY_KEY)
		// not known yet (the first /users/me is on its way): nothing to decide
		if (user === undefined) return
		const ownerId = user?.id ?? null
		useOutboxStore.getState().claim(ownerId)
		useComposerDraftStore.getState().claim(ownerId)
		usePhotoDraftStore.getState().claim(ownerId)
		usePhotoSessionStore.getState().claim(ownerId)
		usePhotoLimitStore.getState().claim(ownerId)
		useFreshReplyStore.getState().claim(ownerId)
		useGoalCelebrationStore.getState().claim(ownerId)
		useLiveWorkoutStore.getState().claim(ownerId)
		// online data only: the flag follows what the API last said about the account
		useLiveWorkoutStore.getState().setPendingDeletion(user?.pendingDeletion ?? false)
	}
	/**
	 * The live session the API answered with (GET current, PUT, start) is kept for an offline cold
	 * start; a closed one (null) is dropped. Only for a known owner, and nothing is logged.
	 */
	const keepLastSeenLive = (event: QueryCacheNotifyEvent): void => {
		if (event.type !== 'updated' || event.action.type !== 'success') return
		const live: unknown = event.query.state.data
		const { setLastSeen, clearLastSeen } = useLiveWorkoutStore.getState()
		if (live === null) {
			clearLastSeen()
			return
		}
		const parsed = liveWorkoutResponseSchema.safeParse(live)
		if (parsed.success) setLastSeen(parsed.data)
	}
	claim()
	return queryClient.getQueryCache().subscribe((event) => {
		if (event.query.queryHash === SESSION_HASH) claim()
		if (event.query.queryHash === LIVE_HASH) keepLastSeenLive(event)
	})
}
