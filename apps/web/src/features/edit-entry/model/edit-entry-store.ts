import type { LoggedMeal } from '@kus/shared'
import { create } from 'zustand'

import { applyEntryChange, type EntryChange } from './apply-entry-change'

export interface EditEntryTarget {
	/** The meal as the screen had it: its entries feed the picker and the form. */
	meal: LoggedMeal
	/** null — the sheet opens on the picker (a chat card with several lines). */
	entryId: string | null
	/** The form was reached through the picker: after a save or delete the sheet goes back to it. */
	isFromPicker?: boolean
}

interface EditEntryState {
	target: EditEntryTarget | null
	open: (target: EditEntryTarget) => void
	selectEntry: (entryId: string) => void
	/** The form is done: back to the picker with what is left of the meal, or closed when nothing is. */
	settle: (change: EntryChange | null) => void
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
		set((state) =>
			state.target ? { target: { ...state.target, entryId, isFromPicker: true } } : state,
		)
	},
	settle: (change) => {
		set(({ target }) => {
			if (!target?.isFromPicker) return { target: null }
			const meal = change ? applyEntryChange(target.meal, change) : target.meal
			return { target: meal ? { meal, entryId: null, isFromPicker: true } : null }
		})
	},
	close: () => {
		set({ target: null })
	},
}))
