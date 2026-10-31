import type { WorkoutExerciseResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { formatSets, SetLine } from '@/entities/workout'
import { Text } from '@/shared/ui'

import { isBodyweightExercise } from '../lib/session-view'

/** The name (15/700, «· власна вага» when no set has weight) and the sets in the notation. */
export const SessionExercise = ({ exercise }: { exercise: WorkoutExerciseResponse }) => {
	const { t } = useTranslation()

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
		</li>
	)
}
