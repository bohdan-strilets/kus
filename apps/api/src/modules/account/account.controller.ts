import { Body, Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { AuthUser } from '@kus/shared'
import type { Response } from 'express'

import { AllowPendingDeletion, type AuthenticatedUser, CurrentUser } from '../../common/decorators'
import { AuthCookieService } from '../auth/auth-cookie.service'
import { STRICT_AUTH_THROTTLE } from '../auth/auth.constants'
import { RESTORE_ACCOUNT_THROTTLE } from './account.constants'
import { AccountService } from './account.service'
import { DeleteAccountDto } from './dto'

@Controller('account')
export class AccountController {
	constructor(
		private readonly accountService: AccountService,
		private readonly authCookies: AuthCookieService,
	) {}

	/** Password-confirmed like a login, so it shares the login throttle. */
	@Throttle(STRICT_AUTH_THROTTLE)
	@Post('delete')
	@HttpCode(HttpStatus.NO_CONTENT)
	async requestDeletion(
		@CurrentUser() user: AuthenticatedUser,
		@Body() body: DeleteAccountDto,
		@Res({ passthrough: true }) response: Response,
	): Promise<void> {
		await this.accountService.requestDeletion(user.sub, body.password)
		this.authCookies.clearTokens(response)
	}

	@AllowPendingDeletion()
	@Throttle(RESTORE_ACCOUNT_THROTTLE)
	@Post('restore')
	@HttpCode(HttpStatus.OK)
	restore(@CurrentUser() user: AuthenticatedUser): Promise<AuthUser> {
		return this.accountService.restore(user.sub)
	}
}
