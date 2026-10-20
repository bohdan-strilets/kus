import { Module } from '@nestjs/common'

import { EntriesModule } from '../entries/entries.module'
import { GoalsModule } from '../goals/goals.module'
import { MeasurementsModule } from '../measurements/measurements.module'
import { ProfileModule } from '../profile/profile.module'
import { UsersModule } from '../users/users.module'
import { ProgressController } from './progress.controller'
import { ProgressService } from './progress.service'
import { ProgressStatsService } from './progress-stats.service'

@Module({
	imports: [EntriesModule, GoalsModule, MeasurementsModule, ProfileModule, UsersModule],
	controllers: [ProgressController],
	providers: [ProgressService, ProgressStatsService],
	exports: [ProgressStatsService],
})
export class ProgressModule {}
