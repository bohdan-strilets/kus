import { Injectable, Logger } from '@nestjs/common'
import type { TrainingOnboarding, TrainingOnboardingState } from '@kus/shared'

import { ProfileService } from '../profile/profile.service'
import { TrainingOnboardingMessagesRepository } from './training-onboarding-messages.repository'
import { deriveOnboardingState, readStoredOnboarding } from './training-onboarding-state'

export interface OnboardingView {
	payload: TrainingOnboarding
	state: TrainingOnboardingState
}

/** The training onboarding messages of the chat with their state, derived on every read. */
@Injectable()
export class ChatTrainingOnboardingViewsService {
	private readonly logger = new Logger(ChatTrainingOnboardingViewsService.name)

	constructor(
		private readonly messages: TrainingOnboardingMessagesRepository,
		private readonly profileService: ProfileService,
	) {}

	async getViews(
		userId: string,
		messages: readonly { id: string; trainingOnboarding: unknown }[],
	): Promise<Map<string, OnboardingView>> {
		const payloads = new Map<string, TrainingOnboarding>()
		for (const { id, trainingOnboarding } of messages) {
			const { payload, isUnreadable } = readStoredOnboarding(trainingOnboarding)
			// the payload is never logged, only the message id
			if (isUnreadable) this.logger.warn(`Unreadable training onboarding message=${id}`)
			if (payload) payloads.set(id, payload)
		}
		const views = new Map<string, OnboardingView>()
		if (payloads.size === 0) return views
		const hasInvitation = [...payloads.values()].some(({ step }) => step === 0)
		const [newestUserMessageId, trainingOnboardingAt] = await Promise.all([
			this.messages.findNewestCompletedUserMessageId(userId),
			hasInvitation ? this.profileService.findTrainingOnboardingAt(userId) : Promise.resolve(null),
		])
		for (const [id, payload] of payloads) {
			const state = deriveOnboardingState(
				{ id, payload },
				{ newestUserMessageId, trainingOnboardingAt },
			)
			views.set(id, { payload, state })
		}
		return views
	}
}
