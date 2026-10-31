import { motion } from 'motion/react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { freshKey, useFreshOnMount, useFreshReplyStore } from '@/entities/message'
import { DeletedWorkoutRow } from '@/entities/workout'
import { TRANSITION } from '@/shared/lib'

import { getExerciseLog } from '../lib/get-exercise-log'
import type { WorkoutCardItem } from '../lib/get-workout-cards'
import { ExerciseLogCard } from './ExerciseLogCard'
import { SessionSummaryCard } from './SessionSummaryCard'

interface WorkoutReplyCardProps {
	item: WorkoutCardItem
	/** Next to Kusik's head; under his words it is an attachment without the tail. */
	hasTail: boolean
}

/**
 * The workout of a reply: the summary of the whole session, or a card per exercise the message
 * added, with the «just logged» entrance played once per fresh reply. A deleted session is one
 * quiet line either way.
 */
export const WorkoutReplyCard = ({ item, hasTail }: WorkoutReplyCardProps) => {
	const { t } = useTranslation()
	const { workout, variant, exerciseIds } = item
	const key = freshKey.workout(workout.id)
	const isFresh = useFreshOnMount(key)
	const handleEntered = useCallback(() => {
		useFreshReplyStore.getState().release(key)
	}, [key])
	if (workout.isDeleted) return <DeletedWorkoutRow workout={workout} hasTail={hasTail} />

	const log = getExerciseLog(workout, exerciseIds, t)
	return (
		<motion.div
			className="flex flex-col gap-1.5"
			initial={isFresh ? { opacity: 0, y: 8 } : false}
			animate={{ opacity: 1, y: 0 }}
			transition={TRANSITION.slow}
			onAnimationComplete={handleEntered}
		>
			{variant === 'SUMMARY' ? (
				<SessionSummaryCard workout={workout} hasTail={hasTail} />
			) : (
				log.exercises.map((exercise, index) => (
					<ExerciseLogCard
						key={exercise.id}
						workout={workout}
						exercise={exercise}
						log={log}
						hasTail={hasTail && index === 0}
					/>
				))
			)}
		</motion.div>
	)
}
