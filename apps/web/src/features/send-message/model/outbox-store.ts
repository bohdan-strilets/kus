import { MESSAGE_TEXT_MAX_LENGTH } from '@kus/shared'
import { z } from 'zod'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { revokeSessionObjectUrl } from '@/shared/lib'

import { PHOTO_LOST_FAILURE, RESTORED_FAILURE, type SendError } from '../lib/get-send-error'

export type OutboxStatus = 'sending' | 'failed'

/** The picture of a message on its way: only in memory, it is too big for the storage. */
export interface OutboxPhoto {
	/** blob: URL of the compressed picture, shown in the bubble; revoked once the item leaves. */
	previewUrl: string
	base64: string
	mimeType: 'image/jpeg'
	width: number
	height: number
}

/** A message on its way, or one that didn't get through; it leaves once the server has the turn. */
export interface OutboxItem {
	clientMessageId: string
	/** Empty for a photo without words. */
	text: string
	photo?: OutboxPhoto
	/** Back from storage after a reload: the words are here, the photo is not. */
	photoLost?: boolean
	/** 0..1 of the photo uploaded, while sending. */
	uploadProgress?: number
	/** ISO; places the bubble in the feed until the server copy arrives. */
	createdAt: string
	status: OutboxStatus
	error: SendError | null
}

interface OutboxState {
	/** Whose drafts these are: on another device user they are not shown, sent or kept. */
	ownerId: string | null
	items: Record<string, OutboxItem>
	/**
	 * blob: URLs of the photos sent in this session, by clientMessageId: the bubble keeps showing
	 * the picture after the server copy replaced the draft. In memory only, gone with a reload.
	 */
	previews: Record<string, string>
	/** The signed-in user (null after logout); a different one drops the drafts of the previous. */
	claim: (userId: string | null) => void
	markSending: (item: Pick<OutboxItem, 'clientMessageId' | 'text' | 'createdAt' | 'photo'>) => void
	setUploadProgress: (clientMessageId: string, ratio: number) => void
	markFailed: (clientMessageId: string, error: SendError) => void
	remove: (clientMessageId: string) => void
}

export const OUTBOX_STORAGE_KEY = 'kusik-outbox'
/** Pictures kept for the bubbles of sent messages; older ones become the «Фото» row. */
export const PREVIEWS_MAX = 30
const OUTBOX_STORAGE_VERSION = 2

/** Only what the user typed: no server answers, no error details. */
const storedItemSchema = z
	.object({
		clientMessageId: z.uuid(),
		text: z.string().max(MESSAGE_TEXT_MAX_LENGTH),
		createdAt: z.iso.datetime(),
		photoLost: z.literal(true).optional(),
	})
	// an empty text is only the leftover of a photo message
	.refine((item) => item.text.length > 0 || item.photoLost === true)

type StoredItem = z.infer<typeof storedItemSchema>

const storedStateSchema = z.object({ ownerId: z.uuid(), items: z.array(z.unknown()) })

interface StoredState {
	ownerId: string | null
	items: StoredItem[]
}

/**
 * «Не надіслано» survives a reload of the PWA; a message still sending is not stored. A photo is
 * never stored: only the fact that there was one, so the bubble can say it has to be retaken.
 */
const toStoredState = ({ ownerId, items }: OutboxState): StoredState => ({
	ownerId,
	items: Object.values(items)
		.filter((item) => item.status === 'failed')
		.map(({ clientMessageId, text, createdAt, photo, photoLost }) => ({
			clientMessageId,
			text,
			createdAt,
			...(photo || photoLost ? { photoLost: true as const } : {}),
		})),
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
			items.map((item): [string, OutboxItem] => [
				item.clientMessageId,
				item.photoLost
					? { ...item, status: 'failed', error: PHOTO_LOST_FAILURE }
					: { ...item, status: 'failed', error: RESTORED_FAILURE },
			]),
		),
	}
}

const revokePreview = (item: OutboxItem | undefined): void => {
	if (item?.photo) revokeSessionObjectUrl(item.photo.previewUrl)
}

const revokeAll = (previews: Record<string, string>): void => {
	Object.values(previews).forEach(revokeSessionObjectUrl)
}

/** Adds the newest; past PREVIEWS_MAX the oldest are revoked (object keys keep insertion order). */
const keepPreview = (
	previews: Record<string, string>,
	clientMessageId: string,
	url: string,
): Record<string, string> => {
	const entries = [...Object.entries(previews), [clientMessageId, url] as const]
	const excess = Math.max(0, entries.length - PREVIEWS_MAX)
	entries.slice(0, excess).forEach(([, oldUrl]) => {
		revokeSessionObjectUrl(oldUrl)
	})
	return Object.fromEntries(entries.slice(excess))
}

/** Outside React so a send finishes even if the chat unmounts (the user switched tabs). */
export const useOutboxStore = create<OutboxState>()(
	persist(
		(set) => ({
			ownerId: null,
			items: {},
			previews: {},
			claim: (userId) => {
				set((state) => {
					if (state.ownerId === userId) return state
					Object.values(state.items).forEach(revokePreview)
					revokeAll(state.previews)
					return { ownerId: userId, items: {}, previews: {} }
				})
			},
			markSending: (item) => {
				set((state) => ({
					items: {
						...state.items,
						[item.clientMessageId]: {
							...item,
							status: 'sending',
							error: null,
							...(item.photo ? { uploadProgress: 0 } : {}),
						},
					},
				}))
			},
			setUploadProgress: (clientMessageId, ratio) => {
				set((state) => {
					const item = state.items[clientMessageId]
					if (item?.status !== 'sending') return state
					return {
						items: { ...state.items, [clientMessageId]: { ...item, uploadProgress: ratio } },
					}
				})
			},
			markFailed: (clientMessageId, error) => {
				set((state) => {
					const item = state.items[clientMessageId]
					if (!item) return state
					return {
						items: {
							...state.items,
							[clientMessageId]: { ...item, status: 'failed', error, uploadProgress: undefined },
						},
					}
				})
			},
			remove: (clientMessageId) => {
				set((state) => {
					const { [clientMessageId]: removed, ...items } = state.items
					// the picture stays for the bubble of the server copy; a dismissed failure has none
					if (!removed?.photo) return { items }
					return {
						items,
						previews: keepPreview(state.previews, clientMessageId, removed.photo.previewUrl),
					}
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
