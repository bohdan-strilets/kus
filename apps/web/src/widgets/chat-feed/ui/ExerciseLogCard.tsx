import type { TrainingGroupKey, WorkoutExerciseResponse, WorkoutResponse } from '@kus/shared'
import { Fragment, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { formatSets, getExerciseIcon, GroupIcon, GroupTag, SetLine } from '@/entities/workout'
import { getTrainingSessionPath } from '@/shared/config'
import { cn } from '@/shared/lib'
import { Icon, Surface, Text } from '@/shared/ui'

import type { ExerciseLogView } from '../lib/get-exercise-log'

const CHEVRON_SIZE = 18
const COUNTS_SEPARATOR = ' · '

/** A piece of the footer line that never breaks inside: the line wraps only between pieces. */
const Segment = ({ children, isBold = false }: { children: ReactNode; isBold?: boolean }) => (
	<Text
		as="span"
		variant="caption"
		weight={isBold ? 'bold' : 'regular'}
		tone={isBold ? 'ink' : 'mutedStrong'}
		className="whitespace-nowrap"
	>
		{children}
	</Text>
)

export interface ExerciseLogCardProps {
	workout: Pick<WorkoutResponse, 'id'>
	exercise: WorkoutExerciseResponse
	log: Pick<ExerciseLogView, 'title' | 'counts' | 'isChanged'>
	/** Next to Kusik's head the card has a tail; under his words it is an attachment. */
	hasTail: boolean
}

const getExerciseGroup = (exercise: WorkoutExerciseResponse): TrainingGroupKey | null =>
	exercise.kind === 'CARDIO' ? 'CARDIO' : exercise.muscleGroup

/**
 * mockups/chat-training.html (B): one exercise written during the session — the icon on the tint of
 * its group, the name and the group plate, the sets, and a row into the session with its counter.
 */
export const ExerciseLogCard = ({ workout, exercise, log, hasTail }: ExerciseLogCardProps) => {
	const { t } = useTranslation()
	const group = getExerciseGroup(exercise)

	return (
		<Surface
			variant="solid"
			radius="bubbleAi"
			className={cn('flex flex-col gap-2 px-3.5 py-3', hasTail && 'rounded-bl-tail')}
		>
			<div className="flex items-center gap-2.5">
				<GroupIcon icon={getExerciseIcon(exercise)} group={group} />
				<Text as="span" weight="bold" className="min-w-0 flex-1">
					{exercise.name}
				</Text>
				{group !== null && <GroupTag group={group} size="sm" />}
			</div>
			<SetLine sets={formatSets(exercise, t)} />
			<Link
				to={getTrainingSessionPath(workout.id)}
				className="-mx-1 -mb-1.5 flex min-h-tap items-center justify-between gap-2 border-t border-line px-1"
			>
				<Text as="span" variant="caption" weight="regular" tone="mutedStrong">
					<Segment>
						{log.title}
						{log.counts !== null && ':'}
					</Segment>
					{log.counts !== null &&
						log.counts.split(COUNTS_SEPARATOR).map((part, index) => (
							<Fragment key={part}>
								{index > 0 && COUNTS_SEPARATOR}
								{index === 0 && ' '}
								<Segment isBold>{part}</Segment>
							</Fragment>
						))}
					{log.isChanged && (
						<>
							{COUNTS_SEPARATOR}
							<Segment>{t('workout.log.changed')}</Segment>
						</>
					)}
				</Text>
				<Icon name="chevron-right" size={CHEVRON_SIZE} className="flex-none text-muted" />
			</Link>
		</Surface>
	)
}
