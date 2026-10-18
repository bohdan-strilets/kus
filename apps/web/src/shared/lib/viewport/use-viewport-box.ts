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
	// iOS doesn't always fire resize/scroll on visualViewport when the PWA returns from the
	// background or rotates, so the shell would keep a stale height: re-read on these too.
	const onResume = (): void => {
		if (document.visibilityState === 'hidden') return
		onChange()
	}
	viewport.addEventListener('resize', onChange)
	viewport.addEventListener('scroll', onChange)
	document.addEventListener('visibilitychange', onResume)
	window.addEventListener('pageshow', onResume)
	window.addEventListener('focus', onResume)
	window.addEventListener('orientationchange', onResume)
	return () => {
		viewport.removeEventListener('resize', onChange)
		viewport.removeEventListener('scroll', onChange)
		document.removeEventListener('visibilitychange', onResume)
		window.removeEventListener('pageshow', onResume)
		window.removeEventListener('focus', onResume)
		window.removeEventListener('orientationchange', onResume)
	}
}

/** The visible box of the screen, live: the app is sized to it so the keyboard never covers it. */
export const useViewportBox = (): ViewportBox =>
	useSyncExternalStore(subscribe, readCurrent, () => NO_VIEWPORT_BOX)
