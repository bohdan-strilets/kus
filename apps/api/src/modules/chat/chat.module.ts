import { Module } from '@nestjs/common'

import { AiModule } from '../ai/ai.module'
import { EntriesModule } from '../entries/entries.module'
import { GoalsModule } from '../goals/goals.module'
import { MemoryModule } from '../memory/memory.module'
import { UsersModule } from '../users/users.module'
import { ChatContextService } from './chat-context.service'
import { ChatEditsService } from './chat-edits.service'
import { ChatFeedService } from './chat-feed.service'
import { ChatResponseService } from './chat-response.service'
import { ChatTurnService } from './chat-turn.service'
import { ChatController } from './chat.controller'
import { ChatRepository } from './chat.repository'
import { ChatService } from './chat.service'
import { ClarificationsController } from './clarifications.controller'
import { ClarificationsRepository } from './clarifications.repository'
import { ClarificationsService } from './clarifications.service'

@Module({
	imports: [AiModule, EntriesModule, GoalsModule, MemoryModule, UsersModule],
	controllers: [ChatController, ClarificationsController],
	providers: [
		ChatService,
		ChatFeedService,
		ChatContextService,
		ChatEditsService,
		ChatRepository,
		ChatResponseService,
		ChatTurnService,
		ClarificationsRepository,
		ClarificationsService,
	],
	// the edit sheet (food-entries) closes the open questions of an entry it changed
	exports: [ClarificationsService],
})
export class ChatModule {}
