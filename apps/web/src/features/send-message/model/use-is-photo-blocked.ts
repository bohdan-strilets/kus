import { useSyncExternalStore } from 'react'

import { usePhotoLimitStore } from './photo-limit-store'

/**
 * Re-notifies React when the limit runs out. The time passing is not store state, so the store
 * alone would leave the camera off until some unrelated render; a timer aimed at `blockedUntil`
 * flips the snapshot exactly then, with no effect and no polling.
 */
const subscribe = (notify: () => void): (() => void) => {
	let timer: ReturnType<typeof setTimeout> | undefined
	const schedule = (): void => {
		clearTimeout(timer)
		const { blockedUntil } = usePhotoLimitStore.getState()
		if (blockedUntil === null) return
		const delay = blockedUntil - Date.now()
		if (delay > 0) timer = setTimeout(notify, delay)
	}
	schedule()
	const unsubscribe = usePhotoLimitStore.subscribe(() => {
		schedule()
		notify()
	})
	return () => {
		clearTimeout(timer)
		unsubscribe()
	}
}

const getSnapshot = (): boolean => {
	const { blockedUntil } = usePhotoLimitStore.getState()
	return blockedUntil !== null && Date.now() < blockedUntil
}

/** True while the daily photo limit is on: the camera is off, the composer says why. */
export const useIsPhotoBlocked = (): boolean => useSyncExternalStore(subscribe, getSnapshot)
