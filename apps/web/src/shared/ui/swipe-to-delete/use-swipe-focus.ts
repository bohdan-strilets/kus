import { type RefObject, useEffect, useRef } from 'react'

import { SWIPE_ROW_ATTRIBUTE } from './use-swipe-open'

/** Rows anywhere inside the container (a list whose rows hold no rows of their own). */
export const SWIPE_ROWS_ANYWHERE = `[${SWIPE_ROW_ATTRIBUTE}]`
/** Rows that are direct children: a card with rows inside it is not counted twice. */
const SWIPE_ROWS_DIRECT = `:scope > [${SWIPE_ROW_ATTRIBUTE}]`
const ROW_CONTROL_SELECTOR = '[data-swipe-content] button:not(:disabled)'

/** How many swipe rows come before `origin` in the container (rows that hold it do not count). */
export const countSwipeRowsBefore = (
	container: HTMLElement,
	origin: Element,
	rowSelector: string = SWIPE_ROWS_DIRECT,
): number =>
	Array.from(container.querySelectorAll(rowSelector)).filter(
		(row) =>
			!row.contains(origin) &&
			(row.compareDocumentPosition(origin) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
	).length

/**
 * Focus after a deletion (docs/components.md «SwipeToDelete»): the neighbouring row, else the
 * element `getFallback` returns («+ Підхід»). `remember(position)` says how many rows were above the
 * deleted one; the focus moves once the list has re-rendered without it.
 */
export const useSwipeFocus = (
	containerRef: RefObject<HTMLElement | null>,
	getFallback: () => HTMLElement | null,
	rowSelector: string = SWIPE_ROWS_DIRECT,
): ((position: number) => void) => {
	const pending = useRef<number | null>(null)

	useEffect(() => {
		const position = pending.current
		const container = containerRef.current
		pending.current = null
		if (position === null || container === null) return
		const rows = container.querySelectorAll(rowSelector)
		const row = rows[Math.min(position, rows.length - 1)]
		const target = row?.querySelector<HTMLElement>(ROW_CONTROL_SELECTOR) ?? getFallback()
		target?.focus()
	})

	return (position) => {
		pending.current = position
	}
}
