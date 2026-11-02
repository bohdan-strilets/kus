import { motion, type PanInfo } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { cn, formatWeekdayShort, PRESS } from '@/shared/lib'

import { Text } from '../text'
import { SWIPE_THRESHOLD_PX } from './week-strip.constants'
import type { WeekStripDay, WeekStripProps } from './week-strip.types'

const getNumberTone = (
	isSelected: boolean,
	isUpcoming: boolean,
): 'onDark' | 'mutedStrong' | 'ink' => {
	if (isSelected) return 'onDark'
	return isUpcoming ? 'mutedStrong' : 'ink'
}

/**
 * docs WeekStrip (mockups/week-strip.html): seven days on white 70%, weekday 12 + date 15/700 + a
 * 6px row for the owner's indicator; the chosen day is a dark ink pill, a day ahead has a thin
 * ring. A swipe turns the week (Motion pan, no preventDefault on pointerdown: it would swallow the
 * tap in WebKit); the day's state is also in the label — colour is never the only carrier.
 */
export const WeekStrip = <TDay extends WeekStripDay>({
	days,
	onSelect,
	onSwipePrev,
	onSwipeNext,
	canGoNext,
	renderIndicator,
}: WeekStripProps<TDay>) => {
	const { t } = useTranslation()

	const handlePanEnd = (_: PointerEvent, info: PanInfo): void => {
		const { x, y } = info.offset
		if (Math.abs(x) < SWIPE_THRESHOLD_PX || Math.abs(x) < Math.abs(y)) return
		if (x > 0) onSwipePrev()
		else if (canGoNext) onSwipeNext()
	}

	return (
		<motion.div
			role="group"
			aria-label={t('week.label')}
			onPanEnd={handlePanEnd}
			className="grid touch-pan-y grid-cols-7 gap-1 rounded-bubble-ai bg-surface/70 p-2"
		>
			{days.map((day) => {
				const { date, isToday, isUpcoming, isSelected, isDisabled, ariaLabel } = day
				return (
					<motion.button
						key={date.toISOString()}
						type="button"
						aria-current={isToday ? 'date' : undefined}
						aria-disabled={isDisabled || undefined}
						aria-label={ariaLabel}
						onClick={() => {
							if (!isDisabled) onSelect(day)
						}}
						{...(isDisabled ? {} : PRESS)}
						className={cn(
							'flex min-h-tap flex-col items-center gap-1 rounded-tile-sm py-1.5',
							isDisabled ? 'cursor-default' : 'cursor-pointer',
							isSelected ? 'bg-ink text-white' : 'text-ink',
							isUpcoming && !isSelected && 'border border-handle',
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
						<Text as="span" weight="bold" tone={getNumberTone(isSelected, isUpcoming)} isTabular>
							{date.getDate()}
						</Text>
						<span className="flex h-1.5 items-center gap-0.5">{renderIndicator(day)}</span>
					</motion.button>
				)
			})}
		</motion.div>
	)
}
