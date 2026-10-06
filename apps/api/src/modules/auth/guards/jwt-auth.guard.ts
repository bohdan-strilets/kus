import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { type AuthenticatedRequest, IS_PUBLIC_KEY } from '../../../common/decorators'
import { AuthCookieService } from '../auth-cookie.service'
import { AuthRequiredException } from '../auth.exceptions'
import { SessionService } from '../session.service'
import { TokenService } from '../token.service'

/** Global guard: every route needs a valid access cookie unless marked @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly authCookies: AuthCookieService,
		private readonly tokenService: TokenService,
		private readonly sessionService: SessionService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		])
		if (isPublic) return true

		const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
		const token = this.authCookies.readAccessToken(request)
		if (!token) throw new AuthRequiredException()

		const user = await this.tokenService.verifyAccessToken(token)
		if (!user) throw new AuthRequiredException()
		// a signed, unexpired token is not enough: its session may have been logged out or revoked
		if (!(await this.sessionService.isSessionActive(user))) throw new AuthRequiredException()

		request.user = user
		return true
	}
}
