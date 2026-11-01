import { Module } from '@nestjs/common'

import { UsersModule } from '../users/users.module'
import { WorkoutsModule } from '../workouts/workouts.module'
import { ProgramsController } from './programs.controller'
import { ProgramsRepository } from './programs.repository'
import { ProgramsService } from './programs.service'

@Module({
	imports: [UsersModule, WorkoutsModule],
	controllers: [ProgramsController],
	providers: [ProgramsService, ProgramsRepository],
	exports: [ProgramsService],
})
export class ProgramsModule {}
