import { Module } from '@nestjs/common'

import { AchievementsModule } from '../achievements/achievements.module'
import { AiModule } from '../ai/ai.module'
import { EntriesModule } from '../entries/entries.module'
import { FactsModule } from '../facts/facts.module'
import { GoalsModule } from '../goals/goals.module'
import { MeasurementsModule } from '../measurements/measurements.module'
import { MemoryModule } from '../memory/memory.module'
import { PhotosModule } from '../photos/photos.module'
import { ProfileModule } from '../profile/profile.module'
import { ProgramsModule } from '../programs/programs.module'
import { ProgressModule } from '../progress/progress.module'
import { UsersModule } from '../users/users.module'
import { WorkoutsModule } from '../workouts/workouts.module'
import { ChatContextService } from './chat-context.service'
import { ChatCloseDayService } from './chat-close-day.service'
import { ChatDayCardService } from './chat-day-card.service'
import { ChatEarlierService } from './chat-earlier.service'
import { ChatHistoryMarkersService } from './chat-history-markers.service'
import { ChatEditsService } from './chat-edits.service'
import { ChatFeedService } from './chat-feed.service'
import { ChatGreetingsService } from './chat-greetings.service'
import { ChatMeasurementCardsService } from './chat-measurement-cards.service'
import { ChatPhotosService } from './chat-photos.service'
import { ChatProgramCardsService } from './chat-program-cards.service'
import { ChatProgramProposalsService } from './chat-program-proposals.service'
import { ChatReadToolsService } from './chat-read-tools.service'
import { ChatResponseService } from './chat-response.service'
import { ChatTrainingOnboardingAnswersService } from './chat-training-onboarding-answers.service'
import { ChatTrainingOnboardingService } from './chat-training-onboarding.service'
import { ChatTrainingOnboardingViewsService } from './chat-training-onboarding-views.service'
import { ChatTurnMeasurementsService } from './chat-turn-measurements.service'
import { ChatFoodRemovalsService } from './chat-food-removals.service'
import { ChatTurnMemoryService } from './chat-turn-memory.service'
import { ChatTurnService } from './chat-turn.service'
import { ChatWorkoutSummaryService } from './chat-workout-summary.service'
import { ChatController } from './chat.controller'
import { ChatRepository } from './chat.repository'
import { ChatService } from './chat.service'
import { ClarificationsController } from './clarifications.controller'
import { ClarificationsRepository } from './clarifications.repository'
import { ClarificationsService } from './clarifications.service'
import { ProgramCardMessagesRepository } from './program-card-messages.repository'
import { ProgramProposalsController } from './program-proposals.controller'
import { TrainingOnboardingController } from './training-onboarding.controller'
import { TrainingOnboardingMessagesRepository } from './training-onboarding-messages.repository'

@Module({
	imports: [
		AchievementsModule,
		AiModule,
		EntriesModule,
		FactsModule,
		GoalsModule,
		MeasurementsModule,
		MemoryModule,
		PhotosModule,
		ProfileModule,
		ProgramsModule,
		ProgressModule,
		UsersModule,
		WorkoutsModule,
	],
	controllers: [
		ChatController,
		ClarificationsController,
		ProgramProposalsController,
		TrainingOnboardingController,
	],
	providers: [
		ChatService,
		ChatFeedService,
		ChatGreetingsService,
		ChatCloseDayService,
		ChatContextService,
		ChatDayCardService,
		ChatEarlierService,
		ChatHistoryMarkersService,
		ChatEditsService,
		ChatFoodRemovalsService,
		ChatMeasurementCardsService,
		ChatPhotosService,
		ChatProgramCardsService,
		ChatProgramProposalsService,
		ChatReadToolsService,
		ChatRepository,
		ChatResponseService,
		ChatTurnMeasurementsService,
		ChatTurnMemoryService,
		ChatTurnService,
		ChatWorkoutSummaryService,
		ChatTrainingOnboardingService,
		ChatTrainingOnboardingAnswersService,
		ChatTrainingOnboardingViewsService,
		ClarificationsRepository,
		ClarificationsService,
		ProgramCardMessagesRepository,
		TrainingOnboardingMessagesRepository,
	],
	// the edit sheet (food-entries) closes the open questions of an entry it changed; account-restore
	// writes Kusik's welcome back into the chat; the measurement sheet answers with a chat card; the live
	// mode and the form (workout-logging) post the summary of a session
	exports: [
		ClarificationsService,
		ChatGreetingsService,
		ChatMeasurementCardsService,
		ChatWorkoutSummaryService,
	],
})
export class ChatModule {}
