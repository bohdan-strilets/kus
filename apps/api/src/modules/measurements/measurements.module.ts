import { Module } from '@nestjs/common'

import { MeasurementsRepository } from './measurements.repository'
import { MeasurementsService } from './measurements.service'

@Module({
	providers: [MeasurementsService, MeasurementsRepository],
	exports: [MeasurementsService],
})
export class MeasurementsModule {}
