import { create } from 'zustand'

import type { SendError } from '../lib/get-send-error'

export type OutboxStatus = 'sending' | 'failed'

/** A message on its way, or one that didn't get through; it leaves once the server has the turn. */
export interface OutboxItem {
	clientMessageId: string
	text: string
	/** ISO; places the bubble in the feed until the server copy arrives. */
	createdAt: string
	status: OutboxStatus
	error: SendError | null
}

interface OutboxState {
	items: Record<string, OutboxItem>
	markSending: (item: Pick<OutboxItem, 'clientMessageId' | 'text' | 'createdAt'>) => void
	markFailed: (clientMessageId: string, error: SendError) => void
	remove: (clientMessageId: string) => void
}

/** Outside React so a send finishes even if the chat unmounts (the user switched tabs). */
export const useOutboxStore = create<OutboxState>()((set) => ({
	items: {},
	markSending: (item) => {
		set((state) => ({
			items: {
				...state.items,
				[item.clientMessageId]: { ...item, status: 'sending', error: null },
			},
		}))
	},
	markFailed: (clientMessageId, error) => {
		set((state) => {
			const item = state.items[clientMessageId]
			if (!item) return state
			return { items: { ...state.items, [clientMessageId]: { ...item, status: 'failed', error } } }
		})
	},
	remove: (clientMessageId) => {
		set((state) => {
			const { [clientMessageId]: _removed, ...items } = state.items
			return { items }
		})
	},
}))
