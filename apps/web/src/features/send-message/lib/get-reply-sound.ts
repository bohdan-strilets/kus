import type { SendMessageResponse } from '@kus/shared'

import type { SoundName } from '@/shared/lib'

const hasWorkoutRecord = ({
	workouts,
}: Pick<SendMessageResponse['assistantMessage'], 'workouts'>): boolean =>
	workouts.some((workout) => workout.exercises.some((exercise) => exercise.record !== null))

/**
 * One sound per turn, the rarest event wins: a failed photo, an achievement and an open question
 * outrank the «logged» chime; a bare weigh-in only gets the soft «saved».
 */
export const getReplySound = ({
	userMessage,
	assistantMessage,
}: Pick<SendMessageResponse, 'userMessage' | 'assistantMessage'>): SoundName | null => {
	if (userMessage.photo?.status === 'FAILED') return 'photoFail'
	if (assistantMessage.achievements.length > 0) return 'achieve'
	// the same fanfare for a lifted record: the card shows the «рекорд» plate beside it
	if (hasWorkoutRecord(assistantMessage)) return 'achieve'
	if (assistantMessage.clarifications.some((clarification) => clarification.status === 'OPEN')) {
		return 'clarify'
	}
	if (assistantMessage.meals.length > 0) return 'kusik'
	if (assistantMessage.measurements.length > 0) return 'saved'
	return null
}
