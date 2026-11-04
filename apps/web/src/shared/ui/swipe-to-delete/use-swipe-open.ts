import { useContext, useEffect, useState } from 'react'

import { SwipeGroupContext } from './swipe-to-delete.context'

export const SWIPE_ROW_ATTRIBUTE = 'data-swipe-row'

/**
 * Whether the row's action is open. In a `SwipeGroup` the group decides (one open row); a tap
 * anywhere outside the open row closes it. No `preventDefault` on the tap: it must not kill the
 * click or the focus of a field.
 */
export const useSwipeOpen = (
	id: string,
): { isOpen: boolean; setIsOpen: (isOpen: boolean) => void } => {
	const group = useContext(SwipeGroupContext)
	const [localOpen, setLocalOpen] = useState(false)
	const isOpen = group ? group.openId === id : localOpen
	const setIsOpen = (next: boolean): void => {
		if (group) {
			if (next) group.setOpenId(id)
			else if (group.openId === id) group.setOpenId(null)
			return
		}
		setLocalOpen(next)
	}

	useEffect(() => {
		if (!isOpen) return
		const close = (event: PointerEvent): void => {
			const target = event.target instanceof Element ? event.target : null
			if (target?.closest(`[${SWIPE_ROW_ATTRIBUTE}]`)?.getAttribute(SWIPE_ROW_ATTRIBUTE) === id) {
				return
			}
			if (group) group.setOpenId(null)
			else setLocalOpen(false)
		}
		document.addEventListener('pointerdown', close)
		return () => {
			document.removeEventListener('pointerdown', close)
		}
	}, [isOpen, id, group])

	return { isOpen, setIsOpen }
}
