import { useTranslation } from 'react-i18next'

import { formatWorkoutTotal } from '@/entities/workout'
import { formatDayHeading } from '@/shared/lib'
import { BaseBottomSheet } from '@/shared/ui'

import { getJournalRow } from '../lib/get-journal-row'
import { getWorkoutMinutes } from '../lib/get-week-summary'
import type { TrainingWeekDay } from '../lib/get-training-week-days'
import { TrainingRow } from './TrainingRow'

interface TrainingDaySheetProps {
	/** The day with several trainings; it stays after the close, so the sheet does not empty while it slides away. */
	day: TrainingWeekDay | null
	isOpen: boolean
	onOpenChange: (isOpen: boolean) => void
}

/** mockups/week-strip.html «Тренування дня»: the trainings of one day as the rows of the journal. */
export const TrainingDaySheet = ({ day, isOpen, onOpenChange }: TrainingDaySheetProps) => {
	const { t } = useTranslation()
	const minutes = day?.workouts.reduce((sum, workout) => sum + getWorkoutMinutes(workout), 0) ?? 0

	return (
		<BaseBottomSheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={day ? formatDayHeading(day.date) : ''}
			description={
				day
					? [
							t('training.journal.week.count', { count: day.workouts.length }),
							minutes > 0 ? formatWorkoutTotal(minutes, t) : null,
						]
							.filter((part): part is string => part !== null)
							.join(' · ')
					: undefined
			}
		>
			<ul aria-label={t('week.dayPicker')} className="flex flex-col divide-y divide-divider">
				{day?.workouts.map((workout) => (
					<li key={workout.id}>
						<TrainingRow row={getJournalRow(workout, t)} isDateShown />
					</li>
				))}
			</ul>
		</BaseBottomSheet>
	)
}
