import type { TrainingOnboarding, TrainingOnboardingQuestionStep } from '@kus/shared'

/** An answer about to be stored: the question as it was read and the values. */
export interface OnboardingAnswer {
	questionId: string
	/** The question's `updatedAt` when read: the write lands only if nobody answered meanwhile. */
	readAt: Date
	payload: TrainingOnboarding
	step: TrainingOnboardingQuestionStep
	values: string[]
}

export const INVITATION: TrainingOnboarding = { v: 1, step: 0, preselected: [], answer: null }

export const toQuestion = (
	step: TrainingOnboardingQuestionStep,
	preselected: string[] = [],
): TrainingOnboarding => ({ v: 1, step, preselected, answer: null })
