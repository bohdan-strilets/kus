import type { ChatMessage, WorkoutCard, WorkoutResponse } from '@kus/shared'

export interface WorkoutCardItem {
	workout: WorkoutResponse
	variant: WorkoutCard['variant']
	exerciseIds: readonly string[]
}

/**
 * What a reply shows for its workouts: the `workoutCards` the backend decided, each with the whole
 * session it belongs to. A message without them but with workouts is older than the migration:
 * its workouts are told whole, so each is a summary. A card whose workout is not in the message
 * is dropped (nothing to draw it from).
 */
export const getWorkoutCards = (
	message: Pick<ChatMessage, 'workouts' | 'workoutCards'>,
): WorkoutCardItem[] => {
	if (message.workoutCards.length === 0) {
		return message.workouts.map((workout) => ({
			workout,
			variant: 'SUMMARY',
			exerciseIds: workout.exercises.map((exercise) => exercise.id),
		}))
	}
	return message.workoutCards.flatMap((card) => {
		const workout = message.workouts.find((item) => item.id === card.workoutId)
		return workout ? [{ workout, variant: card.variant, exerciseIds: card.exerciseIds }] : []
	})
}
