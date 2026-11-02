import type { WorkoutStatsResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import {
	formatWorkoutDistance,
	formatWorkoutTotal,
	getExerciseIcon,
	StatsPanel,
	GroupIcon,
} from '@/entities/workout'
import { Text } from '@/shared/ui'

import { EMPTY_VALUE } from '../lib/training-stats.constants'

interface CardioExercisesProps {
	exercises: WorkoutStatsResponse['cardio']['byExercise']
	/** «4 год 10 хв · 26,4 км» beside the title. */
	summary: string | null
}

/** The machines of the period with time and distance. */
export const CardioExercises = ({ exercises, summary }: CardioExercisesProps) => {
	const { t } = useTranslation()

	return (
		<StatsPanel title={t('muscle.CARDIO')} aside={summary ?? undefined}>
			<ul className="flex flex-col gap-2.5">
				{exercises.map((exercise) => (
					<li key={exercise.exerciseId} className="flex min-h-11 items-center gap-3">
						<GroupIcon
							icon={getExerciseIcon({ kind: 'CARDIO', name: exercise.name })}
							group="CARDIO"
						/>
						<Text as="span" variant="cardTitle" weight="bold" className="min-w-0 flex-1 truncate">
							{exercise.name}
						</Text>
						<Text as="span" variant="caption" weight="bold" isTabular>
							{formatWorkoutTotal(exercise.durationMin, t)}
						</Text>
						<Text as="span" variant="caption" tone="muted" isTabular className="w-16 text-right">
							{exercise.distanceM === null ? (
								<>
									<span aria-hidden="true">{EMPTY_VALUE}</span>
									<span className="sr-only">{t('training.stats.cardio.noDistance')}</span>
								</>
							) : (
								formatWorkoutDistance(exercise.distanceM, t)
							)}
						</Text>
					</li>
				))}
			</ul>
		</StatsPanel>
	)
}
