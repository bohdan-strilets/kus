import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { cn, formatDayHeading, formatWeekdayShort, PRESS } from '@/shared/lib'
import { Text } from '@/shared/ui'

import type { DayStatus, WeekDay } from './week-strip.types'

export interface WeekStripProps {
	days: readonly WeekDay[]
	selectedDate: Date
	onSelect: (date: Date) => void
}

const STATUS_LABEL_KEY = {
	normal: 'week.dayNormal',
	over: 'week.dayOver',
	empty: 'week.dayEmpty',
} as const

const DOT_CLASS: Record<DayStatus, string> = {
	normal: 'bg-success',
	over: 'bg-over',
	empty: 'bg-transparent',
}

const isSameDay = (a: Date, b: Date): boolean => a.toDateString() === b.toDateString()

/**
 * docs WeekStrip (mockups/today.html): seven days on white 70%, weekday 12 muted + date 15/700 + a
 * 6px dot; the chosen day is a dark ink pill with a white dot. The status is also in the label —
 * colour is never the only carrier (CLAUDE.md §13).
 */
export const WeekStrip = ({ days, selectedDate, onSelect }: WeekStripProps) => {
	const { t } = useTranslation()

	return (
		<div
			role="group"
			aria-label={t('week.label')}
			className="grid grid-cols-7 gap-1 rounded-bubble-ai bg-surface/70 p-2"
		>
			{days.map(({ date, status }) => {
				const isSelected = isSameDay(date, selectedDate)
				return (
					<motion.button
						key={date.toISOString()}
						type="button"
						aria-current={isSelected ? 'date' : undefined}
						aria-label={t(STATUS_LABEL_KEY[status], { day: formatDayHeading(date) })}
						onClick={() => {
							onSelect(date)
						}}
						{...PRESS}
						className={cn(
							'flex min-h-tap cursor-pointer flex-col items-center gap-1 rounded-tile-sm py-1.5',
							isSelected ? 'bg-ink text-white' : 'text-ink',
						)}
					>
						<Text
							as="span"
							variant="small"
							weight="regular"
							tone={isSelected ? 'onDark' : 'muted'}
							className={cn(isSelected && 'text-white/80')}
						>
							{formatWeekdayShort(date)}
						</Text>
						<Text as="span" weight="bold" tone={isSelected ? 'onDark' : 'ink'} isTabular>
							{date.getDate()}
						</Text>
						<span
							className={cn('size-1.5 rounded-full', isSelected ? 'bg-white' : DOT_CLASS[status])}
						/>
					</motion.button>
				)
			})}
		</div>
	)
}
