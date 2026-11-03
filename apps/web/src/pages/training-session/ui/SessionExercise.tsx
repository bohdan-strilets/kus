import type { WorkoutExerciseResponse, WorkoutResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { formatSets, SetLine } from '@/entities/workout'
import { formatInteger } from '@/shared/lib'
import { Text } from '@/shared/ui'

import { isBodyweightExercise } from '../lib/session-view'

/**
 * The name (15/700, «· власна вага» when no set has weight), the sets in the notation and, for a
 * cardio exercise with its own named calories, the line «180 ккал · з табло · на ціль не впливає».
 */
export const SessionExercise = ({
	exercise,
	workoutKcal = null,
}: {
	exercise: WorkoutExerciseResponse
	/** The header's number: a named one equal to this exercise's own is said once, up there. */
	workoutKcal?: WorkoutResponse['kcal']
}) => {
	const { t } = useTranslation()
	const ownKcal = exercise.kind === 'CARDIO' ? exercise.kcalBurned : null
	const isSaidInHeader =
		workoutKcal !== null && workoutKcal.source !== 'ESTIMATE' && workoutKcal.value === ownKcal
	const kcal = isSaidInHeader ? null : ownKcal

	return (
		<li className="flex flex-col gap-1 py-2.5 not-first:border-t not-first:border-line">
			<Text as="span">
				<Text as="span" weight="bold">
					{exercise.name}
				</Text>
				{isBodyweightExercise(exercise) && (
					<Text as="span" variant="small" tone="muted" weight="medium">
						{' · '}
						{t('workout.bodyweight')}
					</Text>
				)}
			</Text>
			<SetLine sets={formatSets(exercise, t)} />
			{kcal !== null && (
				<Text as="span" variant="small" tone="muted">
					{t('workout.kcalNote', {
						kcal: formatInteger(kcal),
						source: t(
							`workout.kcalSource.${exercise.kcalSource === 'DEVICE' ? 'DEVICE' : 'MANUAL'}`,
						),
					})}
				</Text>
			)}
		</li>
	)
}
