import { Module } from '@nestjs/common'

import { EntriesRepository } from './entries.repository'
import { EntriesService } from './entries.service'
import { EntryEditsService } from './entry-edits.service'

@Module({
	providers: [EntriesService, EntryEditsService, EntriesRepository],
	exports: [EntriesService, EntryEditsService],
})
export class EntriesModule {}
