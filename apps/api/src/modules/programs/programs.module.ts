import { Module } from '@nestjs/common'

import { UsersModule } from '../users/users.module'
import { WorkoutsModule } from '../workouts/workouts.module'
import { ProgramProposalsRepository } from './program-proposals.repository'
import { ProgramProposalsService } from './program-proposals.service'
import { ProgramVersionsService } from './program-versions.service'
import { ProgramsController } from './programs.controller'
import { ProgramsRepository } from './programs.repository'
import { ProgramsService } from './programs.service'

// the chat imports this module (proposals and their routes live there, next to the messages);
// programs never imports the chat
@Module({
	imports: [UsersModule, WorkoutsModule],
	controllers: [ProgramsController],
	providers: [
		ProgramsService,
		ProgramsRepository,
		ProgramVersionsService,
		ProgramProposalsService,
		ProgramProposalsRepository,
	],
	exports: [ProgramsService, ProgramProposalsService],
})
export class ProgramsModule {}
