import { create } from 'zustand'

import { type CompressedPhoto, compressImage } from '../lib/compress-image'
import { PhotoError, type PhotoErrorKind } from '../lib/compress-image.helpers'

export type PhotoDraftStatus = 'idle' | 'processing' | 'ready' | 'error'
export type PhotoDraftErrorKey = 'chat.photoUnsupported' | 'chat.photoTooLarge'

export interface PhotoDraftPhoto extends CompressedPhoto {
	previewUrl: string
}

interface PhotoDraftState {
	/** Whose photo it is: another user (or none after logout) never sees it. */
	ownerId: string | null
	status: PhotoDraftStatus
	photo: PhotoDraftPhoto | null
	errorKey: PhotoDraftErrorKey | null
	/** The signed-in user (null after logout); a different one drops the previous one's photo. */
	claim: (userId: string | null) => void
	pick: (file: File) => Promise<void>
	clear: () => void
}

const ERROR_KEY_BY_KIND: Record<PhotoErrorKind, PhotoDraftErrorKey> = {
	unsupported: 'chat.photoUnsupported',
	tooLarge: 'chat.photoTooLarge',
}

const EMPTY_DRAFT = { status: 'idle', photo: null, errorKey: null } as const

/** Bumped by every pick and clear: the answer of a superseded compression is thrown away. */
let currentPick = 0

/**
 * The photo chosen for the next message. In memory only: a picture is too big for localStorage
 * and not worth keeping across a reload.
 */
export const usePhotoDraftStore = create<PhotoDraftState>()((set, get) => ({
	ownerId: null,
	...EMPTY_DRAFT,
	claim: (userId) => {
		if (get().ownerId === userId) return
		get().clear()
		set({ ownerId: userId })
	},
	pick: async (file) => {
		get().clear()
		const pickId = currentPick
		set({ status: 'processing' })
		try {
			const compressed = await compressImage(file)
			if (pickId !== currentPick) return
			set({
				status: 'ready',
				photo: { ...compressed, previewUrl: URL.createObjectURL(compressed.blob) },
				errorKey: null,
			})
		} catch (error) {
			if (pickId !== currentPick) return
			const kind = error instanceof PhotoError ? error.kind : 'unsupported'
			set({ status: 'error', photo: null, errorKey: ERROR_KEY_BY_KIND[kind] })
		}
	},
	clear: () => {
		currentPick += 1
		const { photo } = get()
		if (photo) URL.revokeObjectURL(photo.previewUrl)
		set(EMPTY_DRAFT)
	},
}))
