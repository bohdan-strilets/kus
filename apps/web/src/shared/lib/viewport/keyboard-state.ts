import { ZOOM_EPSILON } from './viewport-box'

/** Below this the shrink is the iOS accessory bar (~55 px) or Safari's bars, not the keyboard. */
export const KEYBOARD_MIN_PX = 120

/** How long a freshly focused field counts as «keyboard coming» while the viewport hasn't shrunk yet. */
export const KEYBOARD_GRACE_MS = 700

export type KeyboardPhase = 'open' | 'closed'

export interface KeyboardPhaseInput {
	isFieldFocused: boolean
	/** fullHeight − visualViewport.height. */
	keyboardPx: number
	msSinceFocusIn: number
	hasVisualViewport: boolean
}

/**
 * Whether the on-screen keyboard is up, judged by the visual viewport and not by focus alone:
 * iOS can keep focus without a keyboard (after a picker or a sheet) and keeps the keyboard's space
 * for a moment after blur. Without visualViewport the old proxy applies: a focused text field.
 */
export const getKeyboardPhase = ({
	isFieldFocused,
	keyboardPx,
	msSinceFocusIn,
	hasVisualViewport,
}: KeyboardPhaseInput): KeyboardPhase => {
	if (!hasVisualViewport) return isFieldFocused ? 'open' : 'closed'
	// still shrunk after blur: the app waits until the box grows back
	if (keyboardPx >= KEYBOARD_MIN_PX) return 'open'
	if (isFieldFocused && msSinceFocusIn < KEYBOARD_GRACE_MS) return 'open'
	return 'closed'
}

export interface NextFullHeightInput {
	previous: number | null
	height: number
	scale: number
	isFieldFocused: boolean
	/** After an orientation or window change the old maximum is meaningless: take the value as is. */
	isReseeding: boolean
}

/**
 * The height of the screen without the keyboard: the largest visual viewport height seen while no
 * text field is focused and nothing is zoomed. innerHeight can't serve: iOS PWA shrinks it too.
 */
export const getNextFullHeight = ({
	previous,
	height,
	scale,
	isFieldFocused,
	isReseeding,
}: NextFullHeightInput): number | null => {
	if (isFieldFocused || Math.abs(scale - 1) > ZOOM_EPSILON) return previous
	if (previous === null || isReseeding) return height
	return Math.max(previous, height)
}

export const getKeyboardPx = (fullHeight: number | null, boxHeight: number | null): number =>
	fullHeight === null || boxHeight === null ? 0 : Math.max(0, fullHeight - boxHeight)
