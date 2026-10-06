import { useEffect, useState } from 'react'

/** Matches the threshold from CLAUDE.md §12: shorter waits show nothing, so loaders don't flash. */
export const DEFAULT_FLAG_DELAY_MS = 300

/** True only when `isActive` stays on longer than `delayMs`. */
export const useDelayedFlag = (isActive: boolean, delayMs = DEFAULT_FLAG_DELAY_MS): boolean => {
	const [isShown, setIsShown] = useState(false)
	// reset during render (not in the effect) so the flag drops in the same frame as `isActive`
	if (!isActive && isShown) setIsShown(false)

	useEffect(() => {
		if (!isActive) return
		const timer = setTimeout(() => {
			setIsShown(true)
		}, delayMs)
		return () => {
			clearTimeout(timer)
		}
	}, [isActive, delayMs])

	return isActive && isShown
}
