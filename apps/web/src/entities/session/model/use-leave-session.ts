import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

import { ROUTES } from '@/shared/config'
import { getHistoryIndex } from '@/shared/lib'

import { markPendingLoginPush, consumePendingLoginPush } from '../lib/pending-login-push'
import { browserHistoryEnv, walkHistoryBack } from '../lib/walk-history-back'
import { endSession } from './session-query'

/** history.go is async; a walk back takes a few ms — this is only the safety net. */
const HISTORY_WALK_TIMEOUT_MS = 1000

/**
 * Ends the session in the cache and leaves the app for /login so that nothing of it stays in
 * history (iOS swipe-back shows a snapshot of the previous entry).
 */
export const useLeaveSession = (): { leave: () => void } => {
	const queryClient = useQueryClient()
	const navigate = useNavigate()

	const leave = (): void => {
		const behind = getHistoryIndex(window.history.state)
		if (behind === 0) {
			// leave first: the session guard must not remember this page as «come back here»
			void navigate(ROUTES.login, { replace: true })
			endSession(queryClient)
			return
		}
		// iOS swipe-back shows a snapshot of the previous entry — the chat with its data. Walk back
		// to the first entry of the app and push /login on top: a push drops every entry ahead, so
		// nothing of the app is left in history to go back or forward to. The session ends before
		// the walk: the router renders the first entry as soon as it gets there, and it must find
		// no session and no data — the guard turns it into /login. History ends as two /login
		// entries; going back between them changes nothing, a deliberate price for no app behind.
		endSession(queryClient)
		// in case the walk crosses into an earlier document and this one is gone (pending-login-push)
		markPendingLoginPush()
		walkHistoryBack(
			{
				steps: behind,
				timeoutMs: HISTORY_WALK_TIMEOUT_MS,
				onArrive: () => {
					consumePendingLoginPush()
					// after the router has handled the same popstate
					setTimeout(() => {
						void navigate(ROUTES.login)
					}, 0)
				},
			},
			browserHistoryEnv,
		)
	}

	return { leave }
}
