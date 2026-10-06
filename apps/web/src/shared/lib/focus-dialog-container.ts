/**
 * Radix Dialog `onOpenAutoFocus`: focus the dialog itself instead of its first button, so opening
 * it with a tap doesn't paint a focus ring on «Закрити». Focus still lands inside the dialog for
 * screen readers and the keyboard (Tab goes to the first control).
 */
export const focusDialogContainer = (event: Event): void => {
	event.preventDefault()
	if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus()
}
