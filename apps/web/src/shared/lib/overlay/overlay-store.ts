import { create } from 'zustand'

interface OverlayState {
	/** How many sheets and dialogs are open over the screen (they can stack). */
	count: number
	open: () => void
	close: () => void
}

/**
 * Which overlays cover the screen. A sheet or a dialog registers itself while it is open (see
 * useOverlayOpen); a screen with a scroll position to keep (the chat feed) reads whether any is.
 */
export const useOverlayStore = create<OverlayState>()((set) => ({
	count: 0,
	open: () => {
		set((state) => ({ count: state.count + 1 }))
	},
	close: () => {
		set((state) => ({ count: Math.max(0, state.count - 1) }))
	},
}))
