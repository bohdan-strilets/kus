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
	/** Kept to upload again if the server has dropped the file (an unsent photo lives ~24 h). */
	thumbBase64: string
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
	/**
	 * Id of the photo already uploaded (step 1 done): a resend skips the upload. It is stored with
	 * a failed item, so after a reload the message can still be resent without the picture.
	 */
	photoId?: string
	/** Back from storage after a reload: the words are here, the photo is not. */
	photoLost?: boolean
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
	 * Server messages the user dropped from the feed with «Прибрати»: a photo message that FAILED
	 * on the server and has no stored file (the old inline flow) can't be resent, so it is hidden here instead.
	 */
	hiddenIds: string[]
	/** The signed-in user (null after logout); a different one drops the drafts of the previous. */
	claim: (userId: string | null) => void
	markSending: (
		item: Pick<OutboxItem, 'clientMessageId' | 'text' | 'createdAt' | 'photo' | 'photoId'>,
	) => void
	markFailed: (clientMessageId: string, error: SendError) => void
	/** Step 1 is done: the id survives a failed step 2, so a resend never uploads twice. */
	setPhotoId: (clientMessageId: string, photoId: string | undefined) => void
	/** The server no longer has the file and this device no longer has the picture. */
	markPhotoLost: (clientMessageId: string) => void
	/** The server has the turn: the item leaves; its picture is handed back for the server copy. */
	complete: (clientMessageId: string) => string | null
	/** «Прибрати» or a final failure: the item and its picture go. */
	remove: (clientMessageId: string) => void
	hide: (messageId: string) => void
}

export const OUTBOX_STORAGE_KEY = 'kusik-outbox'
/** Hidden server messages remembered; the oldest are forgotten (they are far up the history). */
export const HIDDEN_MAX = 50
const OUTBOX_STORAGE_VERSION = 2

/** Only what the user typed: no server answers, no error details. */
const storedItemSchema = z
	.object({
		clientMessageId: z.uuid(),
		text: z.string().max(MESSAGE_TEXT_MAX_LENGTH),
		createdAt: z.iso.datetime(),
		photoLost: z.literal(true).optional(),
		photoId: z.uuid().optional(),
	})
	// an empty text is only the leftover of a photo message
	.refine((item) => item.text.length > 0 || item.photoLost === true || item.photoId !== undefined)

type StoredItem = z.infer<typeof storedItemSchema>

const storedStateSchema = z.object({
	ownerId: z.uuid(),
	items: z.array(z.unknown()),
	hiddenIds: z.array(z.uuid()).optional(),
})

interface StoredState {
	ownerId: string | null
	items: StoredItem[]
	hiddenIds: string[]
}

/**
 * «Не надіслано» survives a reload of the PWA; a message still sending is not stored. The bytes of
 * a photo are never stored: an uploaded one keeps only its id (the file is on the server), one
 * that never got there only the fact that there was one, so the bubble can say it has to be retaken.
 */
const toStoredState = ({ ownerId, items, hiddenIds }: OutboxState): StoredState => ({
	ownerId,
	items: Object.values(items)
		.filter((item) => item.status === 'failed')
		.map(({ clientMessageId, text, createdAt, photo, photoId, photoLost }) => ({
			clientMessageId,
			text,
			createdAt,
			...(photoId ? { photoId } : {}),
			...((photo || photoLost) && !photoId ? { photoLost: true as const } : {}),
		})),
	hiddenIds,
})

interface RestoredOutbox {
	ownerId: string | null
	items: Record<string, OutboxItem>
	hiddenIds: string[]
}

/** Storage is outside the app's control: whatever does not parse is dropped, with its owner. */
export const restoreOutbox = (stored: unknown): RestoredOutbox => {
	const state = storedStateSchema.safeParse(stored)
	if (!state.success) return { ownerId: null, items: {}, hiddenIds: [] }
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
		hiddenIds: state.data.hiddenIds ?? [],
	}
}

const revokePreview = (item: OutboxItem | undefined): void => {
	if (item?.photo) revokeSessionObjectUrl(item.photo.previewUrl)
}

/** Outside React so a send finishes even if the chat unmounts (the user switched tabs). */
export const useOutboxStore = create<OutboxState>()(
	persist(
		(set, get) => ({
			ownerId: null,
			items: {},
			hiddenIds: [],
			claim: (userId) => {
				set((state) => {
					if (state.ownerId === userId) return state
					Object.values(state.items).forEach(revokePreview)
					return { ownerId: userId, items: {}, hiddenIds: [] }
				})
			},
			markSending: (item) => {
				set((state) => ({
					items: {
						...state.items,
						[item.clientMessageId]: { ...item, status: 'sending', error: null },
					},
				}))
			},
			setPhotoId: (clientMessageId, photoId) => {
				set((state) => {
					const item = state.items[clientMessageId]
					if (!item) return state
					return { items: { ...state.items, [clientMessageId]: { ...item, photoId } } }
				})
			},
			markPhotoLost: (clientMessageId) => {
				set((state) => {
					const item = state.items[clientMessageId]
					if (!item) return state
					revokePreview(item)
					const { photo: _photo, photoId: _photoId, ...rest } = item
					return {
						items: {
							...state.items,
							[clientMessageId]: {
								...rest,
								photoLost: true,
								status: 'failed',
								error: PHOTO_LOST_FAILURE,
							},
						},
					}
				})
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
			complete: (clientMessageId) => {
				const { [clientMessageId]: completed, ...items } = get().items
				set({ items })
				return completed?.photo?.previewUrl ?? null
			},
			remove: (clientMessageId) => {
				set((state) => {
					const { [clientMessageId]: removed, ...items } = state.items
					revokePreview(removed)
					return { items }
				})
			},
			hide: (messageId) => {
				set((state) => ({
					hiddenIds: [...state.hiddenIds.filter((id) => id !== messageId), messageId].slice(
						-HIDDEN_MAX,
					),
				}))
			},
		}),
		{
			name: OUTBOX_STORAGE_KEY,
			version: OUTBOX_STORAGE_VERSION,
			storage: createJSONStorage(() => localStorage),
			partialize: toStoredState,
			// an older or broken shape is dropped, not migrated: it holds only unsent drafts
			migrate: () => ({ ownerId: null, items: [], hiddenIds: [] }),
			merge: (stored, current) => {
				const restored = restoreOutbox(stored)
				return {
					...current,
					ownerId: restored.ownerId,
					// what is in memory wins: a send may have started before the storage was read
					items: { ...restored.items, ...current.items },
					hiddenIds: [...new Set([...restored.hiddenIds, ...current.hiddenIds])],
				}
			},
		},
	),
)
