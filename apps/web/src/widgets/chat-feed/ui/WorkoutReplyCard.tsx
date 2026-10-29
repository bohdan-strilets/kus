import type { WorkoutResponse } from '@kus/shared'
import { useCallback } from 'react'

import { freshKey, useFreshOnMount, useFreshReplyStore } from '@/entities/message'
import { DeletedWorkoutRow, WorkoutCard } from '@/entities/workout'
import { DeleteWorkoutButton } from '@/features/delete-workout'

interface WorkoutReplyCardProps {
	workout: WorkoutResponse
	/** Next to Kusik's head; under his words it is an attachment without the tail. */
	hasTail: boolean
}

/** A workout card with its «just logged» entrance, played once per fresh reply. */
export const WorkoutReplyCard = ({ workout, hasTail }: WorkoutReplyCardProps) => {
	const key = freshKey.workout(workout.id)
	const isFresh = useFreshOnMount(key)
	const handleEntered = useCallback(() => {
		useFreshReplyStore.getState().release(key)
	}, [key])
	if (workout.isDeleted) return <DeletedWorkoutRow workout={workout} hasTail={hasTail} />
	return (
		<WorkoutCard
			workout={workout}
			hasTail={hasTail}
			isFresh={isFresh}
			onEntered={handleEntered}
			footerAction={<DeleteWorkoutButton workout={workout} />}
		/>
	)
}
