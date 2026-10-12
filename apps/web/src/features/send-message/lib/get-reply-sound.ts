import type { SendMessageResponse } from '@kus/shared'

import type { SoundName } from '@/shared/lib'

/** One sound per turn: a failed photo or an open question outranks the «logged» chime. */
export const getReplySound = ({
	userMessage,
	assistantMessage,
}: Pick<SendMessageResponse, 'userMessage' | 'assistantMessage'>): SoundName | null => {
	if (userMessage.photo?.status === 'FAILED') return 'photoFail'
	if (assistantMessage.clarifications.some((clarification) => clarification.status === 'OPEN')) {
		return 'clarify'
	}
	if (assistantMessage.meals.length > 0) return 'kusik'
	return null
}
