import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { formatLastSets, formatWorkoutMinutes, GroupDot, SetLine } from '@/entities/workout'
import { isExerciseDone, type LiveDraftExercise } from '@/features/live-workout'
import { cn, PRESS } from '@/shared/lib'
import { Icon, ICON_SIZE, Text } from '@/shared/ui'

import { formatPlanTarget } from '../lib/live-exercise-view'

interface LiveExerciseRowProps {
	exercise: LiveDraftExercise
	/** The first exercise after the current one that is not done: «далі · …». */
	isNext: boolean
	/** Makes the exercise the one in hand; null for a row that is only shown. */
	onSelect: (() => void) | null
}

/** mockups/training-live.html: a finished or coming exercise as a 56px row; the chat's own are marked and never edited. */
export const LiveExerciseRow = ({ exercise, isNext, onSelect }: LiveExerciseRowProps) => {
	const { t } = useTranslation()
	const isDone = isExerciseDone(exercise)
	const doneSets = exercise.sets.map(({ reps, weightKg, isWarmup }) => ({
		reps,
		weightKg,
		isWarmup,
	}))
	const result = isDone ? formatLastSets(doneSets, t) : null
	const target = formatPlanTarget(exercise, t)
	const group = exercise.kind === 'CARDIO' ? 'CARDIO' : exercise.muscleGroup
	const detail = exercise.readOnly
		? t('training.live.fromChat')
		: exercise.kind === 'CARDIO' && exercise.durationMin !== null
			? formatWorkoutMinutes(exercise.durationMin, t)
			: null
	const upcoming = target === null ? null : isNext ? t('training.live.next', { target }) : target

	const content = (
		<>
			{isDone ? (
				<span className="flex size-6 flex-none items-center justify-center rounded-full bg-success text-white">
					<Icon name="check" size={ICON_SIZE.small} />
				</span>
			) : (
				<GroupDot group={group} />
			)}
			<Text as="span" variant="cardTitle" className="min-w-0 flex-1 truncate">
				{exercise.name}
			</Text>
			{detail !== null && (
				<Text as="span" variant="small" tone="mutedStrong" className="flex-none">
					{detail}
				</Text>
			)}
			{detail === null && result !== null && <SetLine sets={result} />}
			{detail === null && result === null && upcoming !== null && (
				<Text as="span" variant="small" tone="mutedStrong" className="flex-none">
					{upcoming}
				</Text>
			)}
		</>
	)
	const className = cn(
		'flex min-h-14 w-full items-center gap-2.5 rounded-tile bg-surface/85 px-3 text-left',
		isNext && 'ring-1 ring-line-strong',
	)

	return onSelect === null ? (
		<div className={className}>{content}</div>
	) : (
		<motion.button
			type="button"
			onClick={onSelect}
			{...PRESS}
			className={cn(className, 'cursor-pointer')}
		>
			{content}
		</motion.button>
	)
}
