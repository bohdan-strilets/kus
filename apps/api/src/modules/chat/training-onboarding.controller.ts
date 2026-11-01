import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import type { ChatMessage } from '@kus/shared'

import { type AuthenticatedUser, CurrentUser } from '../../common/decorators'
import { TrainingOnboardingNotFoundException } from './chat.exceptions'
import { ChatFeedService } from './chat-feed.service'
import { ChatTrainingOnboardingService } from './chat-training-onboarding.service'
import { ChatRepository } from './chat.repository'

/** The training onboarding is a run of chat messages; here and not in programs, like the program cards. */
@Controller('programs/onboarding')
export class TrainingOnboardingController {
	constructor(
		private readonly onboarding: ChatTrainingOnboardingService,
		private readonly chatRepository: ChatRepository,
		private readonly chatFeed: ChatFeedService,
	) {}

	/** «Налаштувати в чаті» on the tab, «Так» in the chat: the first (or the open) question. */
	@Post('start')
	async start(@CurrentUser() user: AuthenticatedUser): Promise<ChatMessage> {
		const id = await this.onboarding.start(user.sub, new Date())
		const message = await this.chatRepository.findById({ userId: user.sub, id })
		if (!message) throw new TrainingOnboardingNotFoundException()
		const [dto] = await this.chatFeed.toChatMessages(user.sub, [message])
		if (!dto) throw new TrainingOnboardingNotFoundException()
		return dto
	}

	/** «Пізніше»: never offered again; the tab keeps its button. */
	@Post('dismiss')
	@HttpCode(HttpStatus.NO_CONTENT)
	dismiss(@CurrentUser() user: AuthenticatedUser): Promise<void> {
		return this.onboarding.dismiss(user.sub, new Date())
	}
}
