import { useTranslation } from 'react-i18next'

import { formatWorkoutTotal } from '@/entities/workout'
import { formatWeekdayLong, formatWeekdayShort, toCalendarDate } from '@/shared/lib'
import { Icon, Surface, Text } from '@/shared/ui'

import type { WeekSummary } from '../lib/get-week-summary'

const TRAINED_ICON_SIZE = 18

/** mockups/training-home.html «Цей тиждень»: Monday to Sunday, a mark on the days with a training. */
export const TrainingWeek = ({ summary }: { summary: WeekSummary }) => {
	const { t } = useTranslation()
	const parts =
		summary.count > 0
			? [
					t('training.journal.week.count', { count: summary.count }),
					summary.minutes > 0 ? formatWorkoutTotal(summary.minutes, t) : null,
				].filter((part): part is string => part !== null)
			: [t('training.journal.week.none')]

	return (
		<Surface variant="list" radius="panel" className="flex flex-col gap-2.5 p-3.5">
			<div className="flex items-baseline justify-between gap-2">
				<Text as="span" variant="body" weight="extrabold">
					{t('training.journal.week.title')}
				</Text>
				<Text as="span" variant="caption" weight="regular" tone="muted">
					{parts.join(' · ')}
				</Text>
			</div>
			<ul className="flex justify-between">
				{summary.days.map((day) => {
					const date = toCalendarDate(day.localDate)
					const stateKey = day.hasTraining
						? 'training.journal.week.dayTrained'
						: 'training.journal.week.dayRest'
					return (
						<li key={day.localDate} className="flex flex-col items-center gap-1">
							{/* a listitem takes no aria-label, so the spoken day is hidden text */}
							<span className="sr-only">{t(stateKey, { day: formatWeekdayLong(date) })}</span>
							<Text
								as="span"
								variant="small"
								weight={day.hasTraining ? 'extrabold' : 'semibold'}
								tone={day.hasTraining ? 'ink' : 'muted'}
								aria-hidden="true"
							>
								{formatWeekdayShort(date)}
							</Text>
							<span aria-hidden="true" className="flex size-8.5 items-center justify-center">
								{day.hasTraining ? (
									<span className="flex size-8.5 items-center justify-center rounded-full bg-hint-training-ink text-white">
										<Icon name="training" size={TRAINED_ICON_SIZE} />
									</span>
								) : (
									<span className="size-1.5 rounded-full bg-line-strong" />
								)}
							</span>
						</li>
					)
				})}
			</ul>
		</Surface>
	)
}
