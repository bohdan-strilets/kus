import type { WeekDayStatus } from '../food-week-strip/food-week-strip.types'
import { foodDayDotVariants } from './food-day-dot.variants'

export interface FoodDayDotProps {
	status: WeekDayStatus
	isSelected: boolean
}

/** The food indicator of the week strip: decorative, the status is in the label of the day. */
export const FoodDayDot = ({ status, isSelected }: FoodDayDotProps) => (
	<span aria-hidden="true" className={foodDayDotVariants({ status, isSelected })} />
)
