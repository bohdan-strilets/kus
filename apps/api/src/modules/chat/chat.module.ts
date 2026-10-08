import { Module } from '@nestjs/common'

import { AiModule } from '../ai/ai.module'
import { EntriesModule } from '../entries/entries.module'
import { GoalsModule } from '../goals/goals.module'
import { MemoryModule } from '../memory/memory.module'
import { UsersModule } from '../users/users.module'
import { ChatContextService } from './chat-context.service'
import { ChatFeedService } from './chat-feed.service'
import { ChatController } from './chat.controller'
import { ChatRepository } from './chat.repository'
import { ChatService } from './chat.service'
import { ClarificationsController } from './clarifications.controller'
import { ClarificationsService } from './clarifications.service'

@Module({
	imports: [AiModule, EntriesModule, GoalsModule, MemoryModule, UsersModule],
	controllers: [ChatController, ClarificationsController],
	providers: [
		ChatService,
		ChatFeedService,
		ChatContextService,
		ChatRepository,
		ClarificationsService,
	],
})
export class ChatModule {}
