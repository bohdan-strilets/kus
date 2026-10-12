import type { AuthUser } from '@kus/shared'
import { hashKey, type QueryClient } from '@tanstack/react-query'

import { useFreshReplyStore } from '@/entities/message'
import { SESSION_QUERY_KEY } from '@/entities/session'
import {
	useComposerDraftStore,
	useOutboxStore,
	usePhotoDraftStore,
	usePhotoSessionStore,
} from '@/features/send-message'

const SESSION_HASH = hashKey(SESSION_QUERY_KEY)

/**
 * Unsent messages, the text and the photo in the composer and the pictures of sent messages
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
		useFreshReplyStore.getState().claim(ownerId)
	}
	claim()
	return queryClient.getQueryCache().subscribe((event) => {
		if (event.query.queryHash === SESSION_HASH) claim()
	})
}
