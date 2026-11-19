import type { MessageIntent } from '@kus/shared'
import { useLocation, useNavigate } from 'react-router'

import { getChatEntryIntent } from '../lib/chat-entry-state'

export interface ChatIntent {
	/** The state the chat was opened in («Новий рецепт»), null for the plain chat. */
	intent: MessageIntent | null
	/** The first message is sent: the state ends and the chat is the plain one again. */
	end: () => void
}

/**
 * The state is the `state` of the navigation, not a store: switching to another tab or reloading
 * the app never brings an old «Новий рецепт» back, and «end» replaces the entry so «назад» does not either.
 */
export const useChatIntent = (): ChatIntent => {
	const location = useLocation()
	const navigate = useNavigate()
	const intent = getChatEntryIntent(location.state)

	return {
		intent,
		end: () => {
			if (!intent) return
			void navigate(
				{ pathname: location.pathname, search: location.search, hash: location.hash },
				{ replace: true, state: null },
			)
		},
	}
}
