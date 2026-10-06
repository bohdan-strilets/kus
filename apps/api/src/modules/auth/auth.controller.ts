import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { AuthSessionResponse } from '@kus/shared'
import type { Request, Response } from 'express'

import { type AuthenticatedUser, CurrentUser, Public } from '../../common/decorators'
import { AuthCookieService } from './auth-cookie.service'
import { REFRESH_THROTTLE, STRICT_AUTH_THROTTLE } from './auth.constants'
import { RefreshTokenInvalidException, RefreshTokenReusedException } from './auth.exceptions'
import { AuthService } from './auth.service'
import type { ClientMeta } from './auth.types'
import { LoginDto, RegisterDto } from './dto'
import { RegistrationEnabledGuard } from './guards/registration-enabled.guard'
import { SessionService } from './session.service'

const isDeadRefreshTokenError = (error: unknown): boolean =>
	error instanceof RefreshTokenInvalidException || error instanceof RefreshTokenReusedException

const getClientMeta = (request: Request): ClientMeta => ({
	userAgent: request.get('user-agent') ?? null,
})

@Controller('auth')
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly sessionService: SessionService,
		private readonly authCookies: AuthCookieService,
	) {}

	@Public()
	@UseGuards(RegistrationEnabledGuard)
	@Throttle(STRICT_AUTH_THROTTLE)
	@Post('register')
	async register(
		@Body() body: RegisterDto,
		@Req() request: Request,
		@Res({ passthrough: true }) response: Response,
	): Promise<AuthSessionResponse> {
		const { user, tokens } = await this.authService.register(body, getClientMeta(request))
		this.authCookies.setTokens(response, tokens)
		return { user }
	}

	@Public()
	@Throttle(STRICT_AUTH_THROTTLE)
	@Post('login')
	@HttpCode(HttpStatus.OK)
	async login(
		@Body() body: LoginDto,
		@Req() request: Request,
		@Res({ passthrough: true }) response: Response,
	): Promise<AuthSessionResponse> {
		const { user, tokens } = await this.authService.login(body, getClientMeta(request))
		this.authCookies.setTokens(response, tokens)
		return { user }
	}

	/** Public: it runs exactly when the access token has expired. */
	@Public()
	@Throttle(REFRESH_THROTTLE)
	@Post('refresh')
	@HttpCode(HttpStatus.NO_CONTENT)
	async refresh(
		@Req() request: Request,
		@Res({ passthrough: true }) response: Response,
	): Promise<void> {
		try {
			const tokens = await this.sessionService.refresh(
				this.authCookies.readRefreshToken(request),
				getClientMeta(request),
			)
			this.authCookies.setTokens(response, tokens)
		} catch (error) {
			// a dead refresh token is useless to the client, so drop both cookies; a server error keeps them
			if (isDeadRefreshTokenError(error)) this.authCookies.clearTokens(response)
			throw error
		}
	}

	/** Public: logging out must work with an expired access token too. */
	@Public()
	@Post('logout')
	@HttpCode(HttpStatus.NO_CONTENT)
	async logout(
		@Req() request: Request,
		@Res({ passthrough: true }) response: Response,
	): Promise<void> {
		await this.sessionService.logout(this.authCookies.readRefreshToken(request))
		this.authCookies.clearTokens(response)
	}

	@Post('logout-all')
	@HttpCode(HttpStatus.NO_CONTENT)
	async logoutAll(
		@CurrentUser() user: AuthenticatedUser,
		@Res({ passthrough: true }) response: Response,
	): Promise<void> {
		await this.sessionService.logoutAll(user.sub)
		this.authCookies.clearTokens(response)
	}
}
