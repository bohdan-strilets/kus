import { useRef } from 'react'

import { getFlagStorage, registerDebugTap, toggleViewportDebug } from './viewport-debug.lib'

/** Five quick taps on the version in «Налаштування» turn the overlay on or off (a PWA has no URL bar). */
export const useViewportDebugTaps = (): (() => void) => {
	const taps = useRef<number[]>([])
	return () => {
		const next = registerDebugTap(taps.current, Date.now())
		taps.current = next.taps
		if (next.isToggle) toggleViewportDebug(getFlagStorage())
	}
}
