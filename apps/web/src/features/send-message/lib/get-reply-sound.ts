import type { SendMessageResponse } from '@kus/shared'

import type { SoundName } from '@/shared/lib'

/**
 * One sound per turn, the rarest event wins: a failed photo, an achievement and an open question
 * outrank the «logged» chime; a bare weigh-in only gets the soft «saved».
 */
export const getReplySound = ({
	userMessage,
	assistantMessage,
	hasNewWorkoutRecord,
}: Pick<
	SendMessageResponse,
	'userMessage' | 'assistantMessage' | 'hasNewWorkoutRecord'
>): SoundName | null => {
	if (userMessage.photo?.status === 'FAILED') return 'photoFail'
	if (assistantMessage.achievements.length > 0) return 'achieve'
	// the same fanfare for a record this turn lifted (the backend compares with the earlier results:
	// a first exercise, a warm-up or an addition that beat nothing stay quiet)
	if (hasNewWorkoutRecord) return 'achieve'
	if (assistantMessage.clarifications.some((clarification) => clarification.status === 'OPEN')) {
		return 'clarify'
	}
	if (assistantMessage.meals.length > 0) return 'kusik'
	if (assistantMessage.measurements.length > 0) return 'saved'
	return null
}
