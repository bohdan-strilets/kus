import { create } from 'zustand'

export interface ForgottenFood {
	id: string
	name: string
}

interface ForgottenFoodsState {
	/** Foods Kusik removed in the replies that arrived and have not been announced yet. */
	foods: readonly ForgottenFood[]
	announce: (foods: readonly ForgottenFood[]) => void
	/** Hands the waiting foods to the toast and empties the store. */
	take: () => readonly ForgottenFood[]
}

/**
 * A bridge from `deliverMessage` (runs outside React, so it has no toast) to the toast that offers
 * to undo the removal. The reply field itself is live: after a reload it is empty, so nothing waits.
 */
export const useForgottenFoodsStore = create<ForgottenFoodsState>()((set, get) => ({
	foods: [],
	announce: (foods) => {
		if (foods.length === 0) return
		set((state) => ({ foods: [...state.foods, ...foods] }))
	},
	take: () => {
		const { foods } = get()
		if (foods.length > 0) set({ foods: [] })
		return foods
	},
}))
