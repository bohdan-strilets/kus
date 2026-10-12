import type { ChatMessage } from '@kus/shared'
import { create } from 'zustand'

interface FreshReplyState {
	/** The signed-in user (null after logout); a different one drops the marks of the previous. */
	ownerId: string | null
	/** Meals of replies that arrived in this session: their cards play the «just logged» effect once. */
	mealIds: Readonly<Record<string, true>>
	claim: (userId: string | null) => void
	markFresh: (message: ChatMessage) => void
	release: (mealId: string) => void
}

export const useFreshReplyStore = create<FreshReplyState>()((set) => ({
	ownerId: null,
	mealIds: {},
	claim: (userId) => {
		set((state) => (state.ownerId === userId ? state : { ownerId: userId, mealIds: {} }))
	},
	markFresh: (message) => {
		if (message.meals.length === 0) return
		set((state) => ({
			mealIds: {
				...state.mealIds,
				...Object.fromEntries(message.meals.map((meal) => [meal.id, true as const])),
			},
		}))
	},
	release: (mealId) => {
		set((state) => {
			if (!state.mealIds[mealId]) return state
			const { [mealId]: _released, ...rest } = state.mealIds
			return { mealIds: rest }
		})
	},
}))

export const useIsFreshMeal = (mealId: string): boolean =>
	useFreshReplyStore((state) => state.mealIds[mealId] === true)
