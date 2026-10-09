import type { AuthUser } from '@kus/shared'
import { hashKey, type QueryClient } from '@tanstack/react-query'

import { SESSION_QUERY_KEY } from '@/entities/session'
import { useComposerDraftStore, useOutboxStore } from '@/features/send-message'

const SESSION_HASH = hashKey(SESSION_QUERY_KEY)

/**
 * Unsent messages and the text in the composer belong to the user who typed them: a login as
 * someone else, a logout or a dead refresh drops them from memory and storage, so they are never
 * shown or sent from another account.
 */
export const syncOutboxOwner = (queryClient: QueryClient): (() => void) => {
	const claim = (): void => {
		const user = queryClient.getQueryData<AuthUser | null>(SESSION_QUERY_KEY)
		// not known yet (the first /users/me is on its way): nothing to decide
		if (user === undefined) return
		const ownerId = user?.id ?? null
		useOutboxStore.getState().claim(ownerId)
		useComposerDraftStore.getState().claim(ownerId)
	}
	claim()
	return queryClient.getQueryCache().subscribe((event) => {
		if (event.query.queryHash === SESSION_HASH) claim()
	})
}
