import { useEffect, useState } from 'react'

import { OVERLAY_HOLD_MAX_MS } from './overlay.constants'
import { useOverlayOpen } from './use-overlay'

/**
 * Counts as an overlay while `isActive`, at most OVERLAY_HOLD_MAX_MS. The chat feed stays pinned to
 * its end meanwhile (a card that changes height under it must not unpin it) and once more when the
 * hold ends. A new activity starts with a fresh limit.
 */
export const useOverlayHold = (isActive: boolean): void => {
	const [hasExpired, setHasExpired] = useState(false)
	// adjusted during render, not in an effect
	if (!isActive && hasExpired) setHasExpired(false)
	useEffect(() => {
		if (!isActive) return undefined
		const timer = setTimeout(() => {
			setHasExpired(true)
		}, OVERLAY_HOLD_MAX_MS)
		return () => {
			clearTimeout(timer)
		}
	}, [isActive])
	useOverlayOpen(isActive && !hasExpired)
}

export interface SettleHold {
	/** True from `track` until its task is settled (or while `isBusy`). */
	isSettling: boolean
	/** Marks the task (a refetch) as part of the change: the hold lasts until it is settled. */
	track: <T>(task: Promise<T>) => Promise<T>
}

/**
 * The hold for a change that ends with a refetch: `isBusy` is the request itself, `track` the
 * refetch behind it. The feed is held until both are done.
 */
export const useSettleHold = (isBusy = false): SettleHold => {
	const [tracked, setTracked] = useState(0)
	const isSettling = isBusy || tracked > 0
	useOverlayHold(isSettling)

	const track = async <T>(task: Promise<T>): Promise<T> => {
		setTracked((count) => count + 1)
		try {
			return await task
		} finally {
			setTracked((count) => count - 1)
		}
	}

	return { isSettling, track }
}
