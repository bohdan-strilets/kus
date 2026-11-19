import { Module } from '@nestjs/common'

import { EntriesRepository } from './entries.repository'
import { EntriesService } from './entries.service'
import { EntryEditsService } from './entry-edits.service'
import { PotEntriesRepository } from './pot-entries.repository'
import { PotEntriesService } from './pot-entries.service'

@Module({
	providers: [
		EntriesService,
		EntryEditsService,
		EntriesRepository,
		PotEntriesService,
		PotEntriesRepository,
	],
	exports: [EntriesService, EntryEditsService, PotEntriesService],
})
export class EntriesModule {}
