import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common'
import type { MeasurementCard } from '@kus/shared'

import { type AuthenticatedUser, CurrentUser } from '../../common/decorators'
import { MeasurementParamsDto, UpdateMeasurementDto } from './dto'
import { MeasurementEditsService } from './measurement-edits.service'

/** The weight and waist cards of the chat: correct a value, delete it, bring it back. */
@Controller('measurements')
export class MeasurementsController {
	constructor(private readonly measurementEdits: MeasurementEditsService) {}

	@Patch(':id')
	update(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { id }: MeasurementParamsDto,
		@Body() { value }: UpdateMeasurementDto,
	): Promise<MeasurementCard> {
		return this.measurementEdits.update(user.sub, id, value)
	}

	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	remove(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { id }: MeasurementParamsDto,
	): Promise<void> {
		return this.measurementEdits.remove(user.sub, id)
	}

	@Post(':id/restore')
	@HttpCode(HttpStatus.OK)
	restore(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { id }: MeasurementParamsDto,
	): Promise<MeasurementCard> {
		return this.measurementEdits.restore(user.sub, id)
	}
}
