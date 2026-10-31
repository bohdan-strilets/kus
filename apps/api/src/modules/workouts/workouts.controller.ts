import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import type { WorkoutResponse } from '@kus/shared'

import { type AuthenticatedUser, CurrentUser } from '../../common/decorators'
import { WorkoutDayParamsDto, WorkoutParamsDto, WorkoutsRangeQueryDto } from './dto'
import { WorkoutsService } from './workouts.service'

/** The «Тренування» tab, the session screen and the chat card: read workouts, delete one, bring it back. */
@Controller('workouts')
export class WorkoutsController {
	constructor(private readonly workoutsService: WorkoutsService) {}

	@Get()
	getRange(
		@CurrentUser() user: AuthenticatedUser,
		@Query() query: WorkoutsRangeQueryDto,
	): Promise<WorkoutResponse[]> {
		return this.workoutsService.getRange(user.sub, query)
	}

	@Get('day/:localDate')
	getDay(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { localDate }: WorkoutDayParamsDto,
	): Promise<WorkoutResponse[]> {
		return this.workoutsService.getDay(user.sub, localDate)
	}

	// after the static routes above, so «day/…» never reads as an id
	@Get(':id')
	getOne(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { id }: WorkoutParamsDto,
	): Promise<WorkoutResponse> {
		return this.workoutsService.getOne(user.sub, id)
	}

	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	remove(@CurrentUser() user: AuthenticatedUser, @Param() { id }: WorkoutParamsDto): Promise<void> {
		return this.workoutsService.remove(user.sub, id)
	}

	@Post(':id/restore')
	@HttpCode(HttpStatus.OK)
	restore(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { id }: WorkoutParamsDto,
	): Promise<WorkoutResponse> {
		return this.workoutsService.restore(user.sub, id)
	}
}
