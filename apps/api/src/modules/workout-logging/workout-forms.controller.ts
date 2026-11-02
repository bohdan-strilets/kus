import { Body, Controller, HttpStatus, Post, Res } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { WorkoutFinished } from '@kus/shared'
import type { Response } from 'express'

import { type AuthenticatedUser, CurrentUser } from '../../common/decorators'
import { WorkoutFormDto } from './dto'
import { LIVE_ACTION_THROTTLE } from './workout-logging.constants'
import { WorkoutFormsService } from './workout-forms.service'

/** «Заповнити»: a finished session in one request. */
@Controller('workout-forms')
export class WorkoutFormsController {
	constructor(private readonly forms: WorkoutFormsService) {}

	@Post()
	@Throttle(LIVE_ACTION_THROTTLE)
	async save(
		@CurrentUser() user: AuthenticatedUser,
		@Body() body: WorkoutFormDto,
		@Res({ passthrough: true }) response: Response,
	): Promise<WorkoutFinished> {
		const saved = await this.forms.save(user.sub, body)
		// a repeat of the same clientRequestId
		if (!saved.isCreated) response.status(HttpStatus.OK)
		return saved.response
	}
}
