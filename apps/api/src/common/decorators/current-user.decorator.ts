import { createParamDecorator, type ExecutionContext } from '@nestjs/common'

import type { AuthenticatedRequest, AuthenticatedUser } from './authenticated-user.types'

/**
 * The authenticated user from JwtAuthGuard. Only for non-@Public routes: there the guard
 * has always set `request.user`, so a missing user is a wiring bug, not a client error.
 */
export const CurrentUser = createParamDecorator(
	(_data: unknown, context: ExecutionContext): AuthenticatedUser => {
		const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>()
		if (!user) throw new Error('CurrentUser used on a route without JwtAuthGuard')
		return user
	},
)
