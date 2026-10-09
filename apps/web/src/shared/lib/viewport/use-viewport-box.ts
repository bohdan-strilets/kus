import { useSyncExternalStore } from 'react'

import { getNextViewportBox, NO_VIEWPORT_BOX, type ViewportBox } from './viewport-box'

// iOS Safari doesn't shrink the layout viewport for the keyboard (interactive-widget isn't in a
// public Safari yet): only visualViewport knows how much of the screen is left above it.
let current: ViewportBox = NO_VIEWPORT_BOX

const readCurrent = (): ViewportBox => {
	current = getNextViewportBox(current, window.visualViewport)
	return current
}

const subscribe = (onChange: () => void): (() => void) => {
	const viewport = window.visualViewport
	if (!viewport) return () => undefined
	viewport.addEventListener('resize', onChange)
	viewport.addEventListener('scroll', onChange)
	return () => {
		viewport.removeEventListener('resize', onChange)
		viewport.removeEventListener('scroll', onChange)
	}
}

/** The visible box of the screen, live: the app is sized to it so the keyboard never covers it. */
export const useViewportBox = (): ViewportBox =>
	useSyncExternalStore(subscribe, readCurrent, () => NO_VIEWPORT_BOX)
