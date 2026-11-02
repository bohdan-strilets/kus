import { Module } from '@nestjs/common'

import { MeasurementsModule } from '../measurements/measurements.module'
import { UsersModule } from '../users/users.module'
import { LiveSessionsRepository } from './live-sessions.repository'
import { LiveSessionsService } from './live-sessions.service'
import { WorkoutKcalService } from './workout-kcal.service'
import { WorkoutRecordsService } from './workout-records.service'
import { WorkoutStatsRepository } from './workout-stats.repository'
import { WorkoutStatsService } from './workout-stats.service'
import { WorkoutSessionsService } from './workout-sessions.service'
import { WorkoutsController } from './workouts.controller'
import { WorkoutsRepository } from './workouts.repository'
import { WorkoutsService } from './workouts.service'
import { WorkoutsTurnService } from './workouts-turn.service'

@Module({
	imports: [UsersModule, MeasurementsModule],
	controllers: [WorkoutsController],
	providers: [
		LiveSessionsRepository,
		LiveSessionsService,
		WorkoutKcalService,
		WorkoutRecordsService,
		WorkoutsService,
		WorkoutsTurnService,
		WorkoutSessionsService,
		WorkoutsRepository,
		WorkoutStatsService,
		WorkoutStatsRepository,
	],
	// the live mode and the form (workout-logging) write sessions through these; the chat closes an
	// idle live session through LiveSessionsService
	exports: [
		WorkoutsService,
		WorkoutsTurnService,
		LiveSessionsService,
		WorkoutKcalService,
		WorkoutRecordsService,
	],
})
export class WorkoutsModule {}
