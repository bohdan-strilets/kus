import type { MeasurementCard } from '@kus/shared'
import { create } from 'zustand'

interface EditMeasurementState {
	/** The card as the chat had it; null: the sheet is closed. */
	target: MeasurementCard | null
	open: (target: MeasurementCard) => void
	close: () => void
}

/** Which measurement the sheet edits: a store, since it opens from a card deep in the chat feed. */
export const useEditMeasurementStore = create<EditMeasurementState>()((set) => ({
	target: null,
	open: (target) => {
		set({ target })
	},
	close: () => {
		set({ target: null })
	},
}))
