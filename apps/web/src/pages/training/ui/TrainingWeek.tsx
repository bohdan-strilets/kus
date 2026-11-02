import type { ProgramResponse, WorkoutResponse } from '@kus/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { WorkoutDayDots } from '@/entities/workout'
import { getTrainingSessionPath } from '@/shared/config'
import { formatShortDate, toCalendarDate } from '@/shared/lib'
import { Icon, ICON_SIZE, IconButton, InlineError, Skeleton, Text, WeekStrip } from '@/shared/ui'

import { getProgramWeekdays } from '../lib/get-program-weekdays'
import { getTrainingWeekDays, type TrainingWeekDay } from '../lib/get-training-week-days'
import { getWeekSubtitle } from '../lib/get-week-subtitle'
import { useTrainingWeek } from '../model/use-training-week'
import { TrainingDaySheet } from './TrainingDaySheet'

interface TrainingWeekProps {
	today: string
	/** What the journal already read; the week is cut from it when it is covered. */
	journal: readonly WorkoutResponse[] | undefined
	program: ProgramResponse | null | undefined
}

/**
 * mockups/training-home.html + week-strip.html «Цей тиждень»: the shared week strip with the group
 * dots of the days, ‹ › (and a swipe) for the previous week, a tap opens the training of the day.
 */
export const TrainingWeek = ({ today, journal, program }: TrainingWeekProps) => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const week = useTrainingWeek({ today, journal })
	const [openedDay, setOpenedDay] = useState<TrainingWeekDay | null>(null)
	const [isDayOpen, setIsDayOpen] = useState(false)
	const { summary, showNext } = week
	const days = summary
		? getTrainingWeekDays({ summary, today, programWeekdays: getProgramWeekdays(program), t })
		: null
	const title = week.isCurrent
		? t('training.journal.week.title')
		: summary &&
			`${formatShortDate(toCalendarDate(summary.weekStart))}–${formatShortDate(toCalendarDate(summary.weekEnd))}`

	const handleSelect = (day: TrainingWeekDay): void => {
		const [only] = day.workouts
		if (day.workouts.length === 1 && only) void navigate(getTrainingSessionPath(only.id))
		else if (day.workouts.length > 1) {
			setOpenedDay(day)
			setIsDayOpen(true)
		}
	}

	return (
		<section className="flex flex-col gap-2">
			<div className="flex items-center gap-2 pl-1">
				<div className="flex min-w-0 flex-1 flex-col">
					<Text as="span" variant="body" weight="extrabold">
						{title}
					</Text>
					{summary && (
						<Text as="span" variant="caption" weight="regular" tone="muted">
							{getWeekSubtitle(summary, t)}
						</Text>
					)}
				</div>
				<IconButton variant="frosted" label={t('today.previousWeek')} onClick={week.showPrevious}>
					<Icon name="chevron-left" size={ICON_SIZE.control} />
				</IconButton>
				<IconButton
					variant="frosted"
					label={t('today.nextWeek')}
					onClick={showNext ?? undefined}
					disabled={showNext === null}
				>
					<Icon name="chevron-right" size={ICON_SIZE.control} />
				</IconButton>
			</div>
			{days === null && !week.isError && (
				<Skeleton shape="block" className="h-19 rounded-bubble-ai" />
			)}
			{week.isError && <InlineError message={t('training.loadError')} onRetry={week.retry} />}
			{days && (
				<WeekStrip
					days={days}
					onSelect={handleSelect}
					onSwipePrev={week.showPrevious}
					onSwipeNext={() => showNext?.()}
					canGoNext={showNext !== null}
					renderIndicator={(day) => (
						<WorkoutDayDots
							groups={day.groups}
							hasWorkout={day.workouts.length > 0}
							isPlanned={day.isPlanned}
							isOnDark={day.isSelected}
						/>
					)}
				/>
			)}
			<TrainingDaySheet day={openedDay} isOpen={isDayOpen} onOpenChange={setIsDayOpen} />
		</section>
	)
}
