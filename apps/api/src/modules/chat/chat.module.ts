import { Module } from '@nestjs/common'

import { AchievementsModule } from '../achievements/achievements.module'
import { AiModule } from '../ai/ai.module'
import { EntriesModule } from '../entries/entries.module'
import { GoalsModule } from '../goals/goals.module'
import { MeasurementsModule } from '../measurements/measurements.module'
import { MemoryModule } from '../memory/memory.module'
import { PhotosModule } from '../photos/photos.module'
import { ProfileModule } from '../profile/profile.module'
import { UsersModule } from '../users/users.module'
import { ChatContextService } from './chat-context.service'
import { ChatEditsService } from './chat-edits.service'
import { ChatFeedService } from './chat-feed.service'
import { ChatGreetingsService } from './chat-greetings.service'
import { ChatMeasurementCardsService } from './chat-measurement-cards.service'
import { ChatPhotosService } from './chat-photos.service'
import { ChatResponseService } from './chat-response.service'
import { ChatTurnService } from './chat-turn.service'
import { ChatController } from './chat.controller'
import { ChatRepository } from './chat.repository'
import { ChatService } from './chat.service'
import { ClarificationsController } from './clarifications.controller'
import { ClarificationsRepository } from './clarifications.repository'
import { ClarificationsService } from './clarifications.service'

@Module({
	imports: [
		AchievementsModule,
		AiModule,
		EntriesModule,
		GoalsModule,
		MeasurementsModule,
		MemoryModule,
		PhotosModule,
		ProfileModule,
		UsersModule,
	],
	controllers: [ChatController, ClarificationsController],
	providers: [
		ChatService,
		ChatFeedService,
		ChatGreetingsService,
		ChatContextService,
		ChatEditsService,
		ChatMeasurementCardsService,
		ChatPhotosService,
		ChatRepository,
		ChatResponseService,
		ChatTurnService,
		ClarificationsRepository,
		ClarificationsService,
	],
	// the edit sheet (food-entries) closes the open questions of an entry it changed; account-restore
	// writes Kusik's welcome back into the chat
	exports: [ClarificationsService, ChatGreetingsService],
})
export class ChatModule {}
