import { Module } from '@nestjs/common'

import { MeasurementsModule } from '../measurements/measurements.module'
import { UsersModule } from '../users/users.module'
import { WorkoutKcalService } from './workout-kcal.service'
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
		WorkoutKcalService,
		WorkoutsService,
		WorkoutsTurnService,
		WorkoutSessionsService,
		WorkoutsRepository,
		WorkoutStatsService,
		WorkoutStatsRepository,
	],
	exports: [WorkoutsService, WorkoutsTurnService],
})
export class WorkoutsModule {}
