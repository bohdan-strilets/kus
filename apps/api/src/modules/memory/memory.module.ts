import { Module } from '@nestjs/common'

import { MemoryRepository } from './memory.repository'
import { MemoryService } from './memory.service'

@Module({
	providers: [MemoryService, MemoryRepository],
	exports: [MemoryService],
})
export class MemoryModule {}
