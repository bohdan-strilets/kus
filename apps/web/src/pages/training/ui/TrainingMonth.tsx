import { useTranslation } from 'react-i18next'

import { formatMonthLong, toCalendarDate } from '@/shared/lib'
import { Surface, Text } from '@/shared/ui'

import { getJournalRow } from '../lib/get-journal-row'
import type { WorkoutMonthGroup } from '../lib/group-workouts'
import { TrainingRow } from './TrainingRow'

/** A month heading over one card with its days, newest first. */
export const TrainingMonth = ({ month }: { month: WorkoutMonthGroup }) => {
	const { t } = useTranslation()
	const rows = month.days.flatMap((day) =>
		day.workouts.map((workout, index) => ({
			row: getJournalRow(workout, t),
			isDateShown: index === 0,
		})),
	)

	return (
		<section className="flex flex-col gap-2.5">
			<Text as="span" variant="eyebrow" tone="muted" className="px-1 pt-1.5">
				{formatMonthLong(toCalendarDate(`${month.monthKey}-01`))}
			</Text>
			<Surface variant="list" radius="panel" className="px-3.5 py-0.5">
				<ul className="flex flex-col divide-y divide-divider">
					{rows.map(({ row, isDateShown }) => (
						<li key={row.id}>
							<TrainingRow row={row} isDateShown={isDateShown} />
						</li>
					))}
				</ul>
			</Surface>
		</section>
	)
}
