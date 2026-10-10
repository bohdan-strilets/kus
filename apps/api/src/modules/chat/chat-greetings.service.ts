import { Injectable } from '@nestjs/common'
import type { AuthUser } from '@kus/shared'

import type { Prisma } from '../../generated/prisma/client'
import { ChatRepository } from './chat.repository'
import { getWelcomeBackText } from './welcome-back-text'

/** Kusik's own messages in the chat — templates, no model call. */
@Injectable()
export class ChatGreetingsService {
	constructor(private readonly chatRepository: ChatRepository) {}

	/** Written in the restore transaction, so the chat greets only an account that really came back. */
	async postWelcomeBack(
		user: Pick<AuthUser, 'id' | 'name' | 'addressAs' | 'locale'>,
		tx: Prisma.TransactionClient,
	): Promise<void> {
		await this.chatRepository.createAssistantMessage(
			{ userId: user.id, content: getWelcomeBackText(user) },
			tx,
		)
	}
}
