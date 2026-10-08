import { Module } from '@nestjs/common'

import { UsersModule } from '../users/users.module'
import { GoalsController } from './goals.controller'
import { GoalsRepository } from './goals.repository'
import { GoalsService } from './goals.service'

@Module({
	imports: [UsersModule],
	controllers: [GoalsController],
	providers: [GoalsService, GoalsRepository],
	exports: [GoalsService],
})
export class GoalsModule {}
