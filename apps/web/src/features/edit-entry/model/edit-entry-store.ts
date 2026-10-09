import type { LoggedMeal } from '@kus/shared'
import { create } from 'zustand'

export interface EditEntryTarget {
	/** The meal as the screen had it: its entries feed the picker and the form. */
	meal: LoggedMeal
	/** null — the sheet opens on the picker (a chat card with several lines). */
	entryId: string | null
}

interface EditEntryState {
	target: EditEntryTarget | null
	open: (target: EditEntryTarget) => void
	selectEntry: (entryId: string) => void
	close: () => void
}

/**
 * Which logged entry the sheet edits. A store, not props: the sheet is opened from a line on
 * «Сьогодні» and from a card deep in the chat feed, and lives once per page.
 */
export const useEditEntryStore = create<EditEntryState>()((set) => ({
	target: null,
	open: (target) => {
		set({ target })
	},
	selectEntry: (entryId) => {
		set((state) => (state.target ? { target: { ...state.target, entryId } } : state))
	},
	close: () => {
		set({ target: null })
	},
}))
