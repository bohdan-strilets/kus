import { Module } from '@nestjs/common'

import { EntriesModule } from '../entries/entries.module'
import { MemoryRepository } from './memory.repository'
import { MemoryService } from './memory.service'
import { MyFoodsController } from './my-foods.controller'
import { MyFoodsService } from './my-foods.service'

@Module({
	imports: [EntriesModule],
	controllers: [MyFoodsController],
	providers: [MemoryService, MyFoodsService, MemoryRepository],
	exports: [MemoryService, MyFoodsService],
})
export class MemoryModule {}
