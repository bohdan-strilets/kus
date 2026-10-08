import { Module } from '@nestjs/common'

import { GoalsRepository } from './goals.repository'
import { GoalsService } from './goals.service'

@Module({
	providers: [GoalsService, GoalsRepository],
	exports: [GoalsService],
})
export class GoalsModule {}
