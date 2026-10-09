import { Module } from '@nestjs/common'

import { ChatModule } from '../chat/chat.module'
import { EntriesModule } from '../entries/entries.module'
import { UsersModule } from '../users/users.module'
import { FoodEntriesController } from './food-entries.controller'
import { FoodEntriesService } from './food-entries.service'

@Module({
	imports: [EntriesModule, ChatModule, UsersModule],
	controllers: [FoodEntriesController],
	providers: [FoodEntriesService],
})
export class FoodEntriesModule {}
