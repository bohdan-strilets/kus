import { Body, Controller, Get, Patch } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { AuthUser } from '@kus/shared'

import { type AuthenticatedUser, CurrentUser } from '../../common/decorators'
import { UpdateMeDto } from './dto'
import { UPDATE_ME_THROTTLE } from './users.constants'
import { UsersService } from './users.service'

@Controller('users')
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	// `me` must stay registered before any future `:id` route, or Express matches it as an id
	@Get('me')
	getMe(@CurrentUser() user: AuthenticatedUser): Promise<AuthUser> {
		return this.usersService.getMe(user.sub)
	}

	@Throttle(UPDATE_ME_THROTTLE)
	@Patch('me')
	updateMe(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateMeDto): Promise<AuthUser> {
		return this.usersService.updateMe(user.sub, body)
	}
}
