import { useNavigate } from 'react-router'

import { getHistoryIndex } from './get-history-index'

/**
 * «Назад» of a pushed screen (the profile stack). An entry behind us in this app session is the
 * screen this one was opened from — go there, whatever it was (chat, «Сьогодні», the parent).
 * Nothing behind (a deep link, a reload into the stack): replace with the parent, so the stack
 * unwinds without ever leaving the app or growing the history.
 */
export const useStackBack = (parentTo: string): (() => void) => {
	const navigate = useNavigate()

	return () => {
		if (getHistoryIndex(window.history.state) > 0) {
			void navigate(-1)
			return
		}
		void navigate(parentTo, { replace: true })
	}
}
