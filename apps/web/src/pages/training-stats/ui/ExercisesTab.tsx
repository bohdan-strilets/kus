import type { WorkoutStatsPeriod, WorkoutStatsResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { DETAIL_SEPARATOR, StatsNote } from '@/entities/workout'
import { Surface, Text } from '@/shared/ui'

import { ExerciseRow } from './ExerciseRow'

interface ExercisesTabProps {
	exercises: WorkoutStatsResponse['exercises']
	period: WorkoutStatsPeriod
}

/** «Вправи»: the exercises of the period, the latest on top; a tap opens the exercise screen. */
export const ExercisesTab = ({ exercises, period }: ExercisesTabProps) => {
	const { t } = useTranslation()
	if (exercises.length === 0) return <StatsNote text={t('training.stats.empty.exercises')} />

	const caption = [
		t('training.stats.exercises.caption', { period: t(`training.stats.period.short.${period}`) }),
		t('workout.exerciseCount', { count: exercises.length }),
	].join(DETAIL_SEPARATOR)

	return (
		<>
			<div className="flex items-baseline justify-between gap-2 px-1">
				<Text as="span" variant="eyebrow" tone="muted">
					{caption}
				</Text>
				<Text as="span" variant="small" tone="muted">
					{t('training.stats.exercises.sort')}
				</Text>
			</div>
			<Surface variant="list" radius="bubbleAi" className="px-4 py-1">
				<ul className="flex flex-col divide-y divide-divider">
					{exercises.map((exercise) => (
						<ExerciseRow key={exercise.exerciseId} exercise={exercise} />
					))}
				</ul>
			</Surface>
		</>
	)
}
