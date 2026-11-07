import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Res,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { LiveWorkoutResponse, WorkoutFinishResponse } from '@kus/shared'
import type { Response } from 'express'

import { type AuthenticatedUser, CurrentUser } from '../../common/decorators'
import {
	LiveWorkoutFinishDto,
	LiveWorkoutParamsDto,
	LiveWorkoutStartDto,
	LiveWorkoutUpdateDto,
} from './dto'
import { LiveSnapshotService } from './live-snapshot.service'
import { LiveWorkoutsService } from './live-workouts.service'
import { LIVE_ACTION_THROTTLE, LIVE_SNAPSHOT_THROTTLE } from './workout-logging.constants'

/** The live mode: its own prefix, so «current» never meets WorkoutsController's `:id`. */
@Controller('live-workouts')
export class LiveWorkoutsController {
	constructor(
		private readonly liveWorkouts: LiveWorkoutsService,
		private readonly snapshots: LiveSnapshotService,
	) {}

	// before `:id`, so «current» never reads as an id
	@Get('current')
	getCurrent(@CurrentUser() user: AuthenticatedUser): Promise<LiveWorkoutResponse | null> {
		return this.liveWorkouts.getCurrent(user.sub)
	}

	@Post()
	@Throttle(LIVE_ACTION_THROTTLE)
	async start(
		@CurrentUser() user: AuthenticatedUser,
		@Body() body: LiveWorkoutStartDto,
		@Res({ passthrough: true }) response: Response,
	): Promise<LiveWorkoutResponse> {
		const started = await this.liveWorkouts.start(user.sub, body)
		if (!started.isCreated) response.status(HttpStatus.OK)
		return started.response
	}

	@Put(':id')
	@Throttle(LIVE_SNAPSHOT_THROTTLE)
	update(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { id }: LiveWorkoutParamsDto,
		@Body() body: LiveWorkoutUpdateDto,
	): Promise<LiveWorkoutResponse> {
		return this.snapshots.update(user.sub, id, body)
	}

	@Post(':id/finish')
	@HttpCode(HttpStatus.OK)
	@Throttle(LIVE_ACTION_THROTTLE)
	finish(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { id }: LiveWorkoutParamsDto,
		@Body() body: LiveWorkoutFinishDto,
	): Promise<WorkoutFinishResponse> {
		return this.liveWorkouts.finish(user.sub, id, body)
	}

	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	remove(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { id }: LiveWorkoutParamsDto,
	): Promise<void> {
		return this.liveWorkouts.remove(user.sub, id)
	}
}
