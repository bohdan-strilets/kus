/** Controls a finger could have opened a sheet from; anything else is a container that took the tap. */
const RETURN_TARGET_SELECTOR =
	'button, a[href], [role="button"], [role="tab"], [role="menuitem"], [role="link"]'

/**
 * Where focus may go back when a sheet closes on touch: the control that opened it. A tapped
 * container (a tab panel with tabindex) only took the tap, and focusing it rings the whole list.
 */
export const isFocusReturnTarget = (element: Element): boolean =>
	element.matches(RETURN_TARGET_SELECTOR)
