import { Module } from '@nestjs/common'

import { aiClientProvider } from './ai-client'
import { AiCleanupService } from './ai-cleanup.service'
import { AiUsageService } from './ai-usage.service'
import { AiRepository } from './ai.repository'
import { AiService } from './ai.service'

@Module({
	providers: [aiClientProvider, AiRepository, AiService, AiUsageService, AiCleanupService],
	exports: [AiService, AiUsageService],
})
export class AiModule {}
