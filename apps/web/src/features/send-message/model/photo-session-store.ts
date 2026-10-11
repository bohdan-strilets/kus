import { create } from 'zustand'

import { revokeSessionObjectUrl } from '@/shared/lib'

/** Pictures kept for the bubbles of sent messages; older ones become the «Фото» row. */
export const PREVIEWS_MAX = 30

interface PhotoSessionState {
	/** Whose pictures these are: another user (or none after logout) never sees them. */
	ownerId: string | null
	/** 0..1 of the photo uploaded, by clientMessageId, while the request runs. */
	uploadProgress: Record<string, number>
	/** blob: URLs of the photos sent in this session, by clientMessageId: the server never has them. */
	previews: Record<string, string>
	claim: (userId: string | null) => void
	setUploadProgress: (clientMessageId: string, ratio: number) => void
	clearUploadProgress: (clientMessageId: string) => void
	/** Hands the picture of a sent message over for its bubble; past PREVIEWS_MAX the oldest go. */
	keepPreview: (clientMessageId: string, url: string) => void
}

const revokeAll = (previews: Record<string, string>): void => {
	Object.values(previews).forEach(revokeSessionObjectUrl)
}

/** Object keys keep their insertion order, so the first entries are the oldest. */
const withPreview = (
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

/**
 * What this session knows about photos beyond the outbox: how far an upload got and the pictures
 * of messages already sent. In memory only — never in localStorage, which the outbox writes on
 * every change, and gone with a reload (the bubble then shows the «Фото» row).
 */
export const usePhotoSessionStore = create<PhotoSessionState>()((set) => ({
	ownerId: null,
	uploadProgress: {},
	previews: {},
	claim: (userId) => {
		set((state) => {
			if (state.ownerId === userId) return state
			revokeAll(state.previews)
			return { ownerId: userId, uploadProgress: {}, previews: {} }
		})
	},
	setUploadProgress: (clientMessageId, ratio) => {
		set((state) => ({ uploadProgress: { ...state.uploadProgress, [clientMessageId]: ratio } }))
	},
	clearUploadProgress: (clientMessageId) => {
		set((state) => {
			const { [clientMessageId]: _cleared, ...uploadProgress } = state.uploadProgress
			return { uploadProgress }
		})
	},
	keepPreview: (clientMessageId, url) => {
		set((state) => ({ previews: withPreview(state.previews, clientMessageId, url) }))
	},
}))
