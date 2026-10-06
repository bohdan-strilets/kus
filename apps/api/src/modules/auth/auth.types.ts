import type { AuthUser } from '@kus/shared'

export interface IssuedTokens {
	accessToken: string
	refreshToken: string
}

export interface AuthResult {
	user: AuthUser
	tokens: IssuedTokens
}

/** Request metadata stored with a session; never used for auth decisions. */
export interface ClientMeta {
	userAgent: string | null
}
