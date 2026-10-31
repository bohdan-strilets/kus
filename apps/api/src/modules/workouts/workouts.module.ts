import { Module } from '@nestjs/common'

import { WorkoutSessionsService } from './workout-sessions.service'
import { WorkoutsController } from './workouts.controller'
import { WorkoutsRepository } from './workouts.repository'
import { WorkoutsService } from './workouts.service'
import { WorkoutsTurnService } from './workouts-turn.service'

@Module({
	controllers: [WorkoutsController],
	providers: [WorkoutsService, WorkoutsTurnService, WorkoutSessionsService, WorkoutsRepository],
	exports: [WorkoutsService, WorkoutsTurnService],
})
export class WorkoutsModule {}
