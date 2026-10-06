import type { Request } from 'express'

/** Access-token payload attached to the request by JwtAuthGuard. The user id is `sub`, never `id`. */
export interface AuthenticatedUser {
	sub: string
	/** Refresh-token family (= login session) the access token was issued for. */
	fam: string
}

export interface AuthenticatedRequest extends Request {
	user?: AuthenticatedUser
}
