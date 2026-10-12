import { Module } from '@nestjs/common'

import { GoalsModule } from '../goals/goals.module'
import { MeasurementsModule } from '../measurements/measurements.module'
import { UsersModule } from '../users/users.module'
import { ProfileController } from './profile.controller'
import { ProfileRepository } from './profile.repository'
import { ProfileService } from './profile.service'

@Module({
	imports: [UsersModule, GoalsModule, MeasurementsModule],
	controllers: [ProfileController],
	providers: [ProfileService, ProfileRepository],
	exports: [ProfileService],
})
export class ProfileModule {}
