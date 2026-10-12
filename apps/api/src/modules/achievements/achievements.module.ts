import { Module } from '@nestjs/common'

import { EntriesModule } from '../entries/entries.module'
import { MeasurementsModule } from '../measurements/measurements.module'
import { ProfileModule } from '../profile/profile.module'
import { AchievementsRepository } from './achievements.repository'
import { AchievementsService } from './achievements.service'

@Module({
	imports: [EntriesModule, MeasurementsModule, ProfileModule],
	providers: [AchievementsService, AchievementsRepository],
	exports: [AchievementsService],
})
export class AchievementsModule {}
