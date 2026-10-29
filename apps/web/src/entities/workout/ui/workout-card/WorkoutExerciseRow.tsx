import type { WorkoutExerciseResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { Badge, Icon, Text } from '@/shared/ui'

import { formatExerciseSummary, getExerciseIcon } from '../../lib/format-workout'

const EXERCISE_ICON_SIZE = 20

/** One exercise: the icon tile, the name, the grey line with the sets or the time, and a record. */
export const WorkoutExerciseRow = ({ exercise }: { exercise: WorkoutExerciseResponse }) => {
	const { t } = useTranslation()
	const summary = formatExerciseSummary(exercise, t)

	return (
		<li className="flex items-center gap-2.5 px-1.5 py-1">
			<span className="flex size-9 flex-none items-center justify-center rounded-icon bg-hint-training-bg text-protein-ink">
				<Icon name={getExerciseIcon(exercise)} size={EXERCISE_ICON_SIZE} />
			</span>
			<span className="flex min-w-0 flex-1 flex-col">
				<Text as="span" variant="cardTitle" weight="semibold">
					{exercise.name}
				</Text>
				{summary && (
					<Text as="span" variant="small" tone="muted" isTabular>
						{summary}
					</Text>
				)}
			</span>
			{exercise.record !== null && <Badge variant="record">{t('workout.record')}</Badge>}
		</li>
	)
}
