const FIRST_FIELD_SELECTOR =
	'input:not([type=hidden]), textarea, [role=radio][aria-checked=true], [role=radio]'

/**
 * Radix Dialog `onOpenAutoFocus` for sheets that open on a form: focus the first field (or the
 * chosen radio) instead of the container, so the keyboard comes up straight away.
 */
export const focusFirstField = (event: Event): void => {
	event.preventDefault()
	if (!(event.currentTarget instanceof HTMLElement)) return
	const field = event.currentTarget.querySelector<HTMLElement>(FIRST_FIELD_SELECTOR)
	field?.focus()
}
