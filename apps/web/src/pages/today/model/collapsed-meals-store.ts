import { create } from 'zustand'

interface CollapsedMealsState {
	/** Meals folded by a tap on their header; every other meal shows its lines. */
	collapsedIds: Readonly<Record<string, true>>
	toggle: (mealId: string) => void
}

/**
 * Which meals on «Сьогодні» are folded. In memory only: the choice lives for the session and
 * survives a switch of tabs; a reload opens everything again.
 */
export const useCollapsedMealsStore = create<CollapsedMealsState>()((set) => ({
	collapsedIds: {},
	toggle: (mealId) => {
		set((state) => {
			const { [mealId]: isCollapsed, ...rest } = state.collapsedIds
			return { collapsedIds: isCollapsed ? rest : { ...rest, [mealId]: true } }
		})
	},
}))
