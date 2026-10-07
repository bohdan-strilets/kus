import { Module } from '@nestjs/common'

import { EntriesRepository } from './entries.repository'
import { EntriesService } from './entries.service'

@Module({
	providers: [EntriesService, EntriesRepository],
	exports: [EntriesService],
})
export class EntriesModule {}
