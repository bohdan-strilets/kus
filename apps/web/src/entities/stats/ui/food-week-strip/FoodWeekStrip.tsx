import { useTranslation } from 'react-i18next'

import { formatDayHeading } from '@/shared/lib'
import { WeekStrip, type WeekStripDay } from '@/shared/ui'

import { FoodDayDot } from '../food-day-dot/FoodDayDot'
import type { WeekDay, WeekDayStatus } from './food-week-strip.types'

export interface FoodWeekStripProps {
	days: readonly WeekDay[]
	selectedDate: Date
	/** Today by the user's clock: `aria-current` marks it, the pill follows the chosen day. */
	today: Date
	onSelect: (date: Date) => void
	onSwipePrev: () => void
	onSwipeNext: () => void
	canGoNext: boolean
}

interface FoodStripDay extends WeekStripDay {
	status: WeekDayStatus
}

const STATUS_LABEL_KEY = {
	normal: 'week.dayNormal',
	over: 'week.dayOver',
	empty: 'week.dayEmpty',
	planned: 'todayAhead.dayPlanned',
} as const

/** A day after today is never «без записів»: it is simply ahead (the training strip says the same). */
const UPCOMING_EMPTY_LABEL_KEY = 'week.dayUpcoming'

const isSameDay = (a: Date, b: Date): boolean => a.toDateString() === b.toDateString()

/** «Сьогодні»: the shared week strip with a food dot (success / over / a ring of a plan) per day. */
export const FoodWeekStrip = ({
	days,
	selectedDate,
	today,
	onSelect,
	onSwipePrev,
	onSwipeNext,
	canGoNext,
}: FoodWeekStripProps) => {
	const { t } = useTranslation()
	const stripDays = days.map(({ date, status, isUpcoming = false }): FoodStripDay => {
		const labelKey =
			isUpcoming && status === 'empty' ? UPCOMING_EMPTY_LABEL_KEY : STATUS_LABEL_KEY[status]
		return {
			date,
			status,
			isToday: isSameDay(date, today),
			isUpcoming,
			isSelected: isSameDay(date, selectedDate),
			isDisabled: false,
			ariaLabel: t(labelKey, { day: formatDayHeading(date) }),
		}
	})

	return (
		<WeekStrip
			days={stripDays}
			onSelect={(day) => {
				onSelect(day.date)
			}}
			onSwipePrev={onSwipePrev}
			onSwipeNext={onSwipeNext}
			canGoNext={canGoNext}
			renderIndicator={(day) => <FoodDayDot status={day.status} isSelected={day.isSelected} />}
		/>
	)
}
