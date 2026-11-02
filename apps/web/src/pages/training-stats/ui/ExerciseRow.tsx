import type { WorkoutStatsExercise } from '@kus/shared'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { DETAIL_SEPARATOR, formatBestSet, formatChange, GroupDot } from '@/entities/workout'
import { getTrainingExercisePath } from '@/shared/config'
import { Icon, ICON_SIZE, Sparkline, Text } from '@/shared/ui'

const TROPHY_ICON_SIZE = 13

/** One exercise of the period: the whole row opens its screen. The trend is decoration, the text says the same. */
export const ExerciseRow = ({ exercise }: { exercise: WorkoutStatsExercise }) => {
	const { t } = useTranslation()
	const best = formatBestSet(exercise.best, t)
	const change = formatChange(exercise, t)

	return (
		<li>
			<Link
				to={getTrainingExercisePath(exercise.exerciseId)}
				className="flex min-h-15 items-center gap-3 py-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink"
			>
				<GroupDot group={exercise.muscleGroup} />
				<span className="flex min-w-0 flex-1 flex-col">
					<Text as="span" variant="cardTitle" weight="bold" className="truncate">
						{exercise.name}
					</Text>
					{best !== null && (
						<Text as="span" variant="small" tone="mutedStrong">
							<span className="inline-flex items-center gap-0.75 text-success-ink">
								<Icon name="trophy" size={TROPHY_ICON_SIZE} />
								<Trans
									i18nKey="training.stats.exercises.best"
									values={{ value: best }}
									components={{ b: <b className="font-bold" /> }}
								/>
							</span>
							{change !== null && `${DETAIL_SEPARATOR}${change}`}
						</Text>
					)}
				</span>
				<span aria-hidden="true">
					<Sparkline size="mini" values={exercise.trend} label={exercise.name} />
				</span>
				<Icon name="chevron-right" size={ICON_SIZE.small} className="flex-none text-muted" />
			</Link>
		</li>
	)
}
