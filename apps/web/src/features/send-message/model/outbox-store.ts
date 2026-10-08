import { MESSAGE_TEXT_MAX_LENGTH } from '@kus/shared'
import { z } from 'zod'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { RESTORED_FAILURE, type SendError } from '../lib/get-send-error'

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
	/** Whose drafts these are: on another device user they are not shown, sent or kept. */
	ownerId: string | null
	items: Record<string, OutboxItem>
	/** The signed-in user (null after logout); a different one drops the drafts of the previous. */
	claim: (userId: string | null) => void
	markSending: (item: Pick<OutboxItem, 'clientMessageId' | 'text' | 'createdAt'>) => void
	markFailed: (clientMessageId: string, error: SendError) => void
	remove: (clientMessageId: string) => void
}

export const OUTBOX_STORAGE_KEY = 'kusik-outbox'
const OUTBOX_STORAGE_VERSION = 2

/** Only what the user typed: no server answers, no error details. */
const storedItemSchema = z.object({
	clientMessageId: z.uuid(),
	text: z.string().min(1).max(MESSAGE_TEXT_MAX_LENGTH),
	createdAt: z.iso.datetime(),
})

type StoredItem = z.infer<typeof storedItemSchema>

const storedStateSchema = z.object({ ownerId: z.uuid(), items: z.array(z.unknown()) })

interface StoredState {
	ownerId: string | null
	items: StoredItem[]
}

/** «Не надіслано» survives a reload of the PWA; a message still sending is not stored. */
const toStoredState = ({ ownerId, items }: OutboxState): StoredState => ({
	ownerId,
	items: Object.values(items)
		.filter((item) => item.status === 'failed')
		.map(({ clientMessageId, text, createdAt }) => ({ clientMessageId, text, createdAt })),
})

/** Storage is outside the app's control: whatever does not parse is dropped, with its owner. */
export const restoreOutbox = (
	stored: unknown,
): { ownerId: string | null; items: Record<string, OutboxItem> } => {
	const state = storedStateSchema.safeParse(stored)
	if (!state.success) return { ownerId: null, items: {} }
	const items = state.data.items.flatMap((item) => {
		const parsed = storedItemSchema.safeParse(item)
		return parsed.success ? [parsed.data] : []
	})
	return {
		ownerId: state.data.ownerId,
		items: Object.fromEntries(
			items.map((item) => [
				item.clientMessageId,
				{ ...item, status: 'failed' as const, error: RESTORED_FAILURE },
			]),
		),
	}
}

/** Outside React so a send finishes even if the chat unmounts (the user switched tabs). */
export const useOutboxStore = create<OutboxState>()(
	persist(
		(set) => ({
			ownerId: null,
			items: {},
			claim: (userId) => {
				set((state) => (state.ownerId === userId ? state : { ownerId: userId, items: {} }))
			},
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
					return {
						items: { ...state.items, [clientMessageId]: { ...item, status: 'failed', error } },
					}
				})
			},
			remove: (clientMessageId) => {
				set((state) => {
					const { [clientMessageId]: _removed, ...items } = state.items
					return { items }
				})
			},
		}),
		{
			name: OUTBOX_STORAGE_KEY,
			version: OUTBOX_STORAGE_VERSION,
			storage: createJSONStorage(() => localStorage),
			partialize: toStoredState,
			// an older or broken shape is dropped, not migrated: it holds only unsent drafts
			migrate: () => ({ ownerId: null, items: [] }),
			merge: (stored, current) => {
				const restored = restoreOutbox(stored)
				return {
					...current,
					ownerId: restored.ownerId,
					// what is in memory wins: a send may have started before the storage was read
					items: { ...restored.items, ...current.items },
				}
			},
		},
	),
)
