import { useEffect } from 'react'

import { useOverlayStore } from './overlay-store'

/** Called by a sheet or a dialog with its own `isOpen`: it counts as an overlay while it is open. */
export const useOverlayOpen = (isOpen: boolean): void => {
	useEffect(() => {
		if (!isOpen) return undefined
		const { open, close } = useOverlayStore.getState()
		open()
		return close
	}, [isOpen])
}

/** Whether any sheet or dialog is open over the screen. */
export const useIsOverlayOpen = (): boolean => useOverlayStore((state) => state.count > 0)
