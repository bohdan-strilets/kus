import { COARSE_POINTER_QUERY, useMediaQuery } from '../use-media-query'
import { useIsTextFieldFocused } from './use-text-field-focus'

/**
 * A field has focus on a touch screen: the on-screen keyboard is up. A desktop with a physical
 * keyboard keeps its tab bar while typing. Focus is a proxy, not the keyboard itself: Android's
 * «back» hides the keyboard without a blur, and an iPad with a keyboard case counts as typing —
 * fine for an iPhone-first app, the bar returns with the next tap outside the field.
 */
export const useIsTypingOnTouch = (): boolean => {
	const isFieldFocused = useIsTextFieldFocused()
	const isTouch = useMediaQuery(COARSE_POINTER_QUERY)
	return isFieldFocused && isTouch
}
