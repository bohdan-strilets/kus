import { Controller, Get, Param } from '@nestjs/common'
import type { DayResponse } from '@kus/shared'

import { type AuthenticatedUser, CurrentUser } from '../../common/decorators'
import { DaysService } from './days.service'
import { DayParamsDto } from './dto'

@Controller('days')
export class DaysController {
	constructor(private readonly daysService: DaysService) {}

	@Get(':localDate')
	getDay(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { localDate }: DayParamsDto,
	): Promise<DayResponse> {
		return this.daysService.getDay(user.sub, localDate)
	}
}
