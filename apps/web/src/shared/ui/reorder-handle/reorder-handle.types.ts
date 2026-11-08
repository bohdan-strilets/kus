import type { PointerEvent } from 'react'

export interface ReorderHandleProps {
	/** Accessible name — the icon alone says nothing to a screen reader. */
	label: string
	/** Where the item stands now; a change brings the focus back to the handle after a keyboard move. */
	index: number
	/** False when the move is not possible (the first item up, the last down). */
	onMove: (delta: -1 | 1) => boolean
	/** Starts a drag; without it the handle is keyboard-only. */
	onPointerDown?: (event: PointerEvent<HTMLButtonElement>) => void
}
