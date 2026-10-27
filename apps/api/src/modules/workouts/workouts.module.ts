import { Module } from '@nestjs/common'

import { WorkoutsController } from './workouts.controller'
import { WorkoutsRepository } from './workouts.repository'
import { WorkoutsService } from './workouts.service'

@Module({
	controllers: [WorkoutsController],
	providers: [WorkoutsService, WorkoutsRepository],
	exports: [WorkoutsService],
})
export class WorkoutsModule {}
