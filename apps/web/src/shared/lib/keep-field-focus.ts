/**
 * A tap on a button must not take the focus from the field: otherwise iOS hides the keyboard, the
 * layout shifts and the click never reaches the button. Attach it to onMouseDown only: the
 * preventDefault on pointerdown makes WebKit swallow mousedown/mouseup/click after a touch tap, so
 * never put it on pointerdown.
 */
export const keepFieldFocus = (event: { preventDefault: () => void }): void => {
	event.preventDefault()
}
