import { Controller, Get } from '@nestjs/common'
import type { AuthUser } from '@kus/shared'

import { type AuthenticatedUser, CurrentUser } from '../../common/decorators'
import { UsersService } from './users.service'

@Controller('users')
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	// `me` must stay registered before any future `:id` route, or Express matches it as an id
	@Get('me')
	getMe(@CurrentUser() user: AuthenticatedUser): Promise<AuthUser> {
		return this.usersService.getMe(user.sub)
	}
}
