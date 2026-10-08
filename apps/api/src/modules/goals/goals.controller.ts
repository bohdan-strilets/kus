import { Body, Controller, Put } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { DailyGoal } from '@kus/shared'

import { type AuthenticatedUser, CurrentUser } from '../../common/decorators'
import { SetGoalDto } from './dto'
import { SET_GOAL_THROTTLE } from './goals.constants'
import { GoalsService } from './goals.service'

@Controller('goals')
export class GoalsController {
	constructor(private readonly goalsService: GoalsService) {}

	@Throttle(SET_GOAL_THROTTLE)
	@Put('current')
	setCurrent(@CurrentUser() user: AuthenticatedUser, @Body() body: SetGoalDto): Promise<DailyGoal> {
		return this.goalsService.setCurrentGoal(user.sub, body)
	}
}
