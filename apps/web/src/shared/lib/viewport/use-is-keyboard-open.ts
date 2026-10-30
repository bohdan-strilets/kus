import { useEffect, useState } from 'react'

import { COARSE_POINTER_QUERY, useMediaQuery } from '../use-media-query'
import { getKeyboardPhase, KEYBOARD_GRACE_MS } from './keyboard-state'
import { useIsTextFieldFocused } from './use-text-field-focus'
import { useFieldFocusInAt, useKeyboardPx } from './use-viewport-box'

/**
 * The on-screen keyboard is up (so the tab bar steps aside). Judged by the visual viewport: focus
 * alone lies on iOS (focus without a keyboard after a sheet or picker; the keyboard's space stays
 * a moment after blur). Only a touch screen has one: a desktop keeps its tab bar while typing.
 */
export const useIsKeyboardOpen = (): boolean => {
	const isFieldFocused = useIsTextFieldFocused()
	const isTouch = useMediaQuery(COARSE_POINTER_QUERY)
	const keyboardPx = useKeyboardPx()
	const focusInAt = useFieldFocusInAt()
	// the focus time the grace period has already run out for; re-evaluates once it does
	const [graceOverFor, setGraceOverFor] = useState<number | null>(null)

	useEffect(() => {
		if (focusInAt === null) return
		const remaining = Math.max(0, KEYBOARD_GRACE_MS - (performance.now() - focusInAt))
		const timerId = setTimeout(() => {
			setGraceOverFor(focusInAt)
		}, remaining)
		return () => {
			clearTimeout(timerId)
		}
	}, [focusInAt])

	if (!isTouch) return false
	const isGraceOver = focusInAt === null || graceOverFor === focusInAt
	const phase = getKeyboardPhase({
		isFieldFocused,
		keyboardPx,
		msSinceFocusIn: isGraceOver ? KEYBOARD_GRACE_MS : 0,
		hasVisualViewport: Boolean(window.visualViewport),
	})
	return phase === 'open'
}
