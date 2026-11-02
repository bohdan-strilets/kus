import type { ReactNode } from 'react'

/** One column of the strip; an indicator of its own is added by the owner of the data. */
export interface WeekStripDay {
	date: Date
	/** Today by the user's clock: marked for screen readers (`aria-current`). */
	isToday: boolean
	/** A day after today: a thin ring around it, its number is muted. */
	isUpcoming: boolean
	/** The dark ink pill: the chosen day on «Сьогодні», the current day on «Тренування». */
	isSelected: boolean
	/** Nothing opens from this day: `aria-disabled`, the tap does nothing. */
	isDisabled: boolean
	/** The spoken day with its state, already translated. */
	ariaLabel: string
}

export interface WeekStripProps<TDay extends WeekStripDay> {
	days: readonly TDay[]
	onSelect: (day: TDay) => void
	/** Swipe to the right: the previous week. */
	onSwipePrev: () => void
	/** Swipe to the left: the next week; ignored while `canGoNext` is false. */
	onSwipeNext: () => void
	canGoNext: boolean
	/** The 6px row under the number: a food dot, group dots, a ring of a program day. */
	renderIndicator: (day: TDay) => ReactNode
}
