import type { ExerciseKind, ExerciseStatsResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { formatSets, SetLine } from '@/entities/workout'
import { formatDayMonthShort, toCalendarDate } from '@/shared/lib'
import { Surface, Text } from '@/shared/ui'

interface HistoryCardProps {
	history: ExerciseStatsResponse['history']
	kind: ExerciseKind
}

/** «Історія»: the last workouts with this exercise, each in the set notation (warm-ups dashed). */
export const HistoryCard = ({ history, kind }: HistoryCardProps) => {
	const { t } = useTranslation()
	if (history.length === 0) return null

	return (
		<section className="flex flex-col gap-1.5">
			<h2 className="px-1 pt-1.5">
				<Text as="span" variant="eyebrow" tone="muted">
					{t('training.stats.exercise.history.title')}
				</Text>
			</h2>
			<Surface variant="list" radius="bubbleAi" className="px-4 py-0.5">
				<ul className="flex flex-col divide-y divide-divider">
					{history.map((item) => (
						<li key={item.workoutId} className="flex flex-col gap-1 py-2.5">
							<Text as="span" variant="small" tone="muted">
								{formatDayMonthShort(toCalendarDate(item.localDate))}
							</Text>
							<SetLine
								sets={formatSets(
									{
										kind,
										sets: item.sets,
										record: item.record,
										durationMin: null,
										distanceM: null,
									},
									t,
								)}
							/>
						</li>
					))}
				</ul>
			</Surface>
		</section>
	)
}
