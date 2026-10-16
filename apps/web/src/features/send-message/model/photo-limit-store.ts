import { create } from 'zustand'

interface PhotoLimitState {
	/** Whose limit it is: another user (or none after logout) is not blocked by it. */
	ownerId: string | null
	/** Epoch ms when the daily photo limit resets; null — nothing is blocked. */
	blockedUntil: number | null
	claim: (userId: string | null) => void
	/** The API said «DAILY_PHOTO_LIMIT_REACHED»; without a usable `resetsAt` nothing stays blocked. */
	block: (resetsAt: unknown) => void
}

/** `resetsAt` is ISO from the API; anything else (or a past time) blocks nothing. */
export const parseResetsAt = (resetsAt: unknown, now: number): number | null => {
	if (typeof resetsAt !== 'string') return null
	const time = Date.parse(resetsAt)
	return Number.isNaN(time) || time <= now ? null : time
}

/**
 * When the daily photo limit ends, so the camera stays off until then. In memory only: after a
 * reload the first upload simply meets the limit again and the API says so.
 */
export const usePhotoLimitStore = create<PhotoLimitState>()((set) => ({
	ownerId: null,
	blockedUntil: null,
	claim: (userId) => {
		set((state) => (state.ownerId === userId ? state : { ownerId: userId, blockedUntil: null }))
	},
	block: (resetsAt) => {
		set({ blockedUntil: parseResetsAt(resetsAt, Date.now()) })
	},
}))
