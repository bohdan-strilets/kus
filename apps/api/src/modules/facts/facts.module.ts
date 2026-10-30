import { Module } from '@nestjs/common'

import { FactsCleanupService } from './facts-cleanup.service'
import { FactsController } from './facts.controller'
import { FactsRepository } from './facts.repository'
import { FactsService } from './facts.service'

@Module({
	controllers: [FactsController],
	providers: [FactsService, FactsCleanupService, FactsRepository],
	exports: [FactsService],
})
export class FactsModule {}
