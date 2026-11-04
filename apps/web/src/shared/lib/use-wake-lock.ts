import { useEffect, useState } from 'react'

const isWakeLockSupported = (): boolean =>
	typeof navigator !== 'undefined' && 'wakeLock' in navigator

/**
 * Keeps the screen on while `isActive` and the page is visible (the browser drops the lock when
 * the page hides, so it is asked for again on `visibilitychange`). `isUnavailable` is true when
 * the API is missing or the request was refused: the screen may go dark then.
 */
export const useWakeLock = (isActive: boolean): { isUnavailable: boolean } => {
	const [isRefused, setIsRefused] = useState(false)

	useEffect(() => {
		if (!isActive || !isWakeLockSupported()) return
		let sentinel = null as WakeLockSentinel | null
		let isCancelled = false

		const request = async (): Promise<void> => {
			if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return
			try {
				const lock = await navigator.wakeLock.request('screen')
				if (isCancelled) {
					await lock.release()
					return
				}
				sentinel = lock
				setIsRefused(false)
			} catch {
				// a refusal (power saving, no permission) is shown to the person as the hint strip
				if (!isCancelled) setIsRefused(true)
			}
		}
		const onVisibilityChange = (): void => {
			void request()
		}

		void request()
		document.addEventListener('visibilitychange', onVisibilityChange)
		return () => {
			isCancelled = true
			document.removeEventListener('visibilitychange', onVisibilityChange)
			void sentinel?.release()
		}
	}, [isActive])

	return { isUnavailable: isActive && (!isWakeLockSupported() || isRefused) }
}
