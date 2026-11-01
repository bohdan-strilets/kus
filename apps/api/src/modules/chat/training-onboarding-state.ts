import {
	type TrainingOnboarding,
	type TrainingOnboardingState,
	trainingOnboardingSchema,
} from '@kus/shared'

export interface OnboardingStateInput {
	/** The newest completed user message of the chat; a message older than it was passed by. */
	newestUserMessageId: string | null
	/** Set once the user took up or declined the invitation. */
	trainingOnboardingAt: Date | null
}

/**
 * ANSWERED with an answer; CLOSED once a later user message completed (it was not the answer, or
 * the answer would be stored) or, for the invitation, once it was taken up or declined; else OPEN.
 * uuid v7 ids grow with time, so they compare as the order of the chat.
 */
export const deriveOnboardingState = (
	{ id, payload }: { id: string; payload: TrainingOnboarding },
	{ newestUserMessageId, trainingOnboardingAt }: OnboardingStateInput,
): TrainingOnboardingState => {
	if (payload.answer !== null) return 'ANSWERED'
	if (newestUserMessageId !== null && newestUserMessageId > id) return 'CLOSED'
	if (payload.step === 0 && trainingOnboardingAt !== null) return 'CLOSED'
	return 'OPEN'
}

/** A stored payload that no longer parses reads as none (the caller logs the message id only). */
export const readStoredOnboarding = (
	value: unknown,
): { payload: TrainingOnboarding | null; isUnreadable: boolean } => {
	if (value === null || value === undefined) return { payload: null, isUnreadable: false }
	const result = trainingOnboardingSchema.safeParse(value)
	return result.success
		? { payload: result.data, isUnreadable: false }
		: { payload: null, isUnreadable: true }
}
