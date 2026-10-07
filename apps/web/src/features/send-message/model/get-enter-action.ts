export interface EnterKeyState {
	key: string
	shiftKey: boolean
	/** An IME is composing (e.g. picking a candidate): Enter confirms the candidate, not the message. */
	isComposing: boolean
	/** Touch-first device (pointer: coarse): Enter is a new line there, only the button sends. */
	isCoarsePointer: boolean
	/** The text without surrounding whitespace is not empty. */
	hasText: boolean
}

/** default — let the browser handle the key (a new line); send — submit; block — swallow it. */
export type EnterAction = 'default' | 'send' | 'block'

/**
 * What a keydown in the composer does. With a physical keyboard Enter sends and Shift+Enter makes
 * a new line; an Enter with nothing to send does nothing. On touch devices Enter is always a new
 * line, and during IME composition it belongs to the IME.
 */
export const getEnterAction = ({
	key,
	shiftKey,
	isComposing,
	isCoarsePointer,
	hasText,
}: EnterKeyState): EnterAction => {
	if (key !== 'Enter' || isComposing || shiftKey || isCoarsePointer) return 'default'
	return hasText ? 'send' : 'block'
}
