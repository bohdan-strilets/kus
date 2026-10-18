import { Module } from '@nestjs/common'

import { ChatModule } from '../chat/chat.module'
import { MeasurementEditsService } from './measurement-edits.service'
import { MeasurementsController } from './measurements.controller'
import { MeasurementsModule } from './measurements.module'

/**
 * The routes live apart from MeasurementsModule: their answers are chat cards, and ChatModule
 * itself imports MeasurementsModule.
 */
@Module({
	imports: [MeasurementsModule, ChatModule],
	controllers: [MeasurementsController],
	providers: [MeasurementEditsService],
})
export class MeasurementEditsModule {}
