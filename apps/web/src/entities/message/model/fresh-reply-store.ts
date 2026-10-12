import type { ChatMessage } from '@kus/shared'
import { create } from 'zustand'

/** A card stays «just logged» this long after its reply arrived; a later visit to the chat shows none. */
export const FRESH_TTL_MS = 10_000

interface FreshReplyState {
	/** The signed-in user (null after logout); a different one drops the marks of the previous. */
	ownerId: string | null
	/** When (ms) the reply with each meal arrived in this session: its card plays the «just logged» effect once. */
	freshAt: Readonly<Record<string, number>>
	claim: (userId: string | null) => void
	markFresh: (message: ChatMessage, now?: number) => void
	isFresh: (mealId: string, now?: number) => boolean
	release: (mealId: string) => void
}

export const useFreshReplyStore = create<FreshReplyState>()((set, get) => ({
	ownerId: null,
	freshAt: {},
	claim: (userId) => {
		set((state) => (state.ownerId === userId ? state : { ownerId: userId, freshAt: {} }))
	},
	markFresh: (message, now = Date.now()) => {
		if (message.meals.length === 0) return
		set((state) => {
			// expired marks go on every write, so the store does not grow over a long session
			const alive = Object.entries(state.freshAt).filter(([, at]) => now - at < FRESH_TTL_MS)
			return {
				freshAt: {
					...Object.fromEntries(alive),
					...Object.fromEntries(message.meals.map((meal) => [meal.id, now])),
				},
			}
		})
	},
	isFresh: (mealId, now = Date.now()) => {
		const at = get().freshAt[mealId]
		return at !== undefined && now - at < FRESH_TTL_MS
	},
	release: (mealId) => {
		set((state) => {
			if (!(mealId in state.freshAt)) return state
			const { [mealId]: _released, ...rest } = state.freshAt
			return { freshAt: rest }
		})
	},
}))
