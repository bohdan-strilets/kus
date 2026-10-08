import { Module } from '@nestjs/common'

import { EntriesModule } from '../entries/entries.module'
import { GoalsModule } from '../goals/goals.module'
import { UsersModule } from '../users/users.module'
import { DaysController } from './days.controller'
import { DaysService } from './days.service'

@Module({
	imports: [EntriesModule, GoalsModule, UsersModule],
	controllers: [DaysController],
	providers: [DaysService],
})
export class DaysModule {}
