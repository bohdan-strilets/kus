import type { ReactNode } from 'react'

export type SwipeOutcome = 'close' | 'open' | 'commit'

export type SwipeActionVariant = 'danger' | 'neutral'

export interface SwipeToDeleteProps {
	/** The row itself; it moves with the finger. */
	children: ReactNode
	/** Visible text of the action: «Видалити» / «Не робили». */
	actionLabel: string
	/** Accessible name of the action: «Видалити підхід 3». */
	actionAriaLabel: string
	/** `danger` — deletion; `neutral` — «Не робили» (nothing is lost). */
	variant?: SwipeActionVariant
	/** Corner radius of the row: `tile` 16, `chip` 18. */
	radius?: 'tile' | 'chip'
	isDisabled?: boolean
	/** Gets the row's frame, so the caller can tell where the focus goes next. */
	onAction: (row: HTMLElement | null) => void
}
