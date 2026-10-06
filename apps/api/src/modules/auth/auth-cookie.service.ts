import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { CookieOptions, Request, Response } from 'express'

import type { Env } from '../../config'
import {
	ACCESS_COOKIE_NAME,
	ACCESS_COOKIE_PATH,
	ACCESS_TOKEN_TTL_SECONDS,
	REFRESH_COOKIE_NAME,
	REFRESH_COOKIE_PATH,
	REFRESH_TOKEN_TTL_MS,
} from './auth.constants'
import type { IssuedTokens } from './auth.types'

const MS_IN_SECOND = 1000

/** Tokens live only in httpOnly cookies set by the backend — never in JS-readable storage. */
@Injectable()
export class AuthCookieService {
	constructor(private readonly config: ConfigService<Env, true>) {}

	setTokens(response: Response, { accessToken, refreshToken }: IssuedTokens): void {
		response.cookie(ACCESS_COOKIE_NAME, accessToken, {
			...this.getBaseOptions(ACCESS_COOKIE_PATH),
			maxAge: ACCESS_TOKEN_TTL_SECONDS * MS_IN_SECOND,
		})
		response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
			...this.getBaseOptions(REFRESH_COOKIE_PATH),
			maxAge: REFRESH_TOKEN_TTL_MS,
		})
	}

	clearTokens(response: Response): void {
		response.clearCookie(ACCESS_COOKIE_NAME, this.getBaseOptions(ACCESS_COOKIE_PATH))
		response.clearCookie(REFRESH_COOKIE_NAME, this.getBaseOptions(REFRESH_COOKIE_PATH))
	}

	readAccessToken(request: Request): string | null {
		return readCookie(request, ACCESS_COOKIE_NAME)
	}

	readRefreshToken(request: Request): string | null {
		return readCookie(request, REFRESH_COOKIE_NAME)
	}

	private getBaseOptions(path: string): CookieOptions {
		return {
			httpOnly: true,
			// plain http only for local dev and tests; Safari drops Secure cookies on http://localhost
			secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
			sameSite: 'lax',
			path,
			domain: this.config.get('COOKIE_DOMAIN', { infer: true }),
		}
	}
}

const readCookie = (request: Request, name: string): string | null => {
	// cookie-parser types `cookies` as any; narrow before use
	const cookies: unknown = request.cookies
	if (typeof cookies !== 'object' || cookies === null) return null
	const value: unknown = Reflect.get(cookies, name)
	return typeof value === 'string' && value.length > 0 ? value : null
}
