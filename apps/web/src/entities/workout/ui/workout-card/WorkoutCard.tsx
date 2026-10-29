import type { WorkoutResponse } from '@kus/shared'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn, formatTime, TRANSITION } from '@/shared/lib'
import { Badge, Surface, Text } from '@/shared/ui'

import {
	formatWorkoutKcalNote,
	formatWorkoutKind,
	formatWorkoutMinutes,
} from '../../lib/format-workout'
import { WorkoutExerciseRow } from './WorkoutExerciseRow'

export interface WorkoutCardProps {
	workout: WorkoutResponse
	/** In the chat the card sits next to Kusik's head (a tail); in the tab it is a plain card. */
	hasTail?: boolean
	/** The reply just arrived: the card rises in softly (reduced motion drops the move). */
	isFresh?: boolean
	/** The entrance is over: the card is no longer «fresh». */
	onEntered?: () => void
	/** A footer action, e.g. «Видалити»: the entity knows no features, the caller passes it. */
	footerAction?: ReactNode
}

/**
 * docs WorkoutCard (mockups/chat-workout.html, training.html): «Зал · 18:30» with the duration,
 * a row per exercise in the order of the message, and — only for a number the user named — the
 * kcal line that says it does not touch the goal. The footer may carry an action from the caller.
 */
export const WorkoutCard = ({
	workout,
	hasTail = false,
	isFresh = false,
	onEntered,
	footerAction,
}: WorkoutCardProps) => {
	const { t } = useTranslation()
	const kcalNote = formatWorkoutKcalNote(workout, t)
	const hasFooter = Boolean(kcalNote) || footerAction !== undefined

	return (
		<motion.div
			initial={isFresh ? { opacity: 0, y: 8 } : false}
			animate={{ opacity: 1, y: 0 }}
			transition={TRANSITION.slow}
			onAnimationComplete={onEntered}
		>
			<Surface
				variant={hasTail ? 'solid' : 'glass'}
				radius="bubbleAi"
				className={cn('flex flex-col overflow-hidden', hasTail && 'rounded-bl-tail')}
			>
				<div className="flex items-center justify-between gap-2 px-3.5 pt-3 pb-1.5">
					<Text as="span" variant="cardTitle">
						{formatWorkoutKind(workout.place, t)}
						{workout.startedAt !== null && (
							<Text as="span" variant="cardTitle" weight="medium" tone="muted">
								{' '}
								· {formatTime(new Date(workout.startedAt))}
							</Text>
						)}
						{workout.isEdited && (
							<Text as="span" variant="cardTitle" weight="medium" tone="muted">
								{' '}
								· {t('workout.edited')}
							</Text>
						)}
					</Text>
					{workout.durationMin !== null && (
						<Badge variant="training">{formatWorkoutMinutes(workout.durationMin, t)}</Badge>
					)}
				</div>
				<ul className={cn('flex flex-col gap-0.5 px-2', !hasFooter && 'pb-3')}>
					{workout.exercises.map((exercise) => (
						<WorkoutExerciseRow key={exercise.id} exercise={exercise} />
					))}
				</ul>
				{hasFooter && (
					<div className="flex items-center justify-between gap-2 px-3.5 pt-2 pb-3">
						{kcalNote && (
							<Text variant="small" tone="muted">
								{kcalNote}
							</Text>
						)}
						{footerAction && <div className="ml-auto flex-none">{footerAction}</div>}
					</div>
				)}
			</Surface>
		</motion.div>
	)
}
