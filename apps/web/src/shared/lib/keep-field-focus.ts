/**
 * A tap on a button must not take the focus from the field: otherwise iOS hides the keyboard, the
 * layout shifts and the click never reaches the button. Put it on both pointerdown and mousedown.
 */
export const keepFieldFocus = (event: { preventDefault: () => void }): void => {
	event.preventDefault()
}
