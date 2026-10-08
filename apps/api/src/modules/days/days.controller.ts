import { Controller, Get, Param, Query } from '@nestjs/common'
import type { DayInRange, DayResponse } from '@kus/shared'

import { type AuthenticatedUser, CurrentUser } from '../../common/decorators'
import { DaysService } from './days.service'
import { DayParamsDto, DaysRangeQueryDto } from './dto'

@Controller('days')
export class DaysController {
	constructor(private readonly daysService: DaysService) {}

	@Get()
	getDays(
		@CurrentUser() user: AuthenticatedUser,
		@Query() query: DaysRangeQueryDto,
	): Promise<DayInRange[]> {
		return this.daysService.getDays(user.sub, query)
	}

	@Get(':localDate')
	getDay(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { localDate }: DayParamsDto,
	): Promise<DayResponse> {
		return this.daysService.getDay(user.sub, localDate)
	}
}
