import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import type {
	ExerciseDictionaryResponse,
	ExerciseStatsResponse,
	WorkoutResponse,
	WorkoutStatsResponse,
} from '@kus/shared'

import { type AuthenticatedUser, CurrentUser } from '../../common/decorators'
import {
	ExerciseDictionaryQueryDto,
	ExerciseStatsParamsDto,
	WorkoutDayParamsDto,
	WorkoutParamsDto,
	WorkoutsRangeQueryDto,
	WorkoutStatsQueryDto,
} from './dto'
import { WorkoutStatsService } from './workout-stats.service'
import { WorkoutsService } from './workouts.service'

/** The «Тренування» tab, the session screen and the chat card: read workouts, delete one, bring it back. */
@Controller('workouts')
export class WorkoutsController {
	constructor(
		private readonly workoutsService: WorkoutsService,
		private readonly statsService: WorkoutStatsService,
	) {}

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

	@Get('stats')
	getStats(
		@CurrentUser() user: AuthenticatedUser,
		@Query() { period }: WorkoutStatsQueryDto,
	): Promise<WorkoutStatsResponse> {
		return this.statsService.getStats(user.sub, period)
	}

	@Get('exercises')
	listExercises(
		@CurrentUser() user: AuthenticatedUser,
		@Query() query: ExerciseDictionaryQueryDto,
	): Promise<ExerciseDictionaryResponse> {
		return this.workoutsService.listExercises(user.sub, query)
	}

	@Get('exercises/:exerciseId')
	getExerciseStats(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { exerciseId }: ExerciseStatsParamsDto,
		@Query() { period }: WorkoutStatsQueryDto,
	): Promise<ExerciseStatsResponse> {
		return this.statsService.getExerciseStats(user.sub, exerciseId, period)
	}

	// after the static routes above, so «day/…» and «stats» never read as an id
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
