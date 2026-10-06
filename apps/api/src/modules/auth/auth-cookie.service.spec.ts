import type { ConfigService } from '@nestjs/config'
import type { CookieOptions, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'

import type { Env } from '../../config'
import { AuthCookieService } from './auth-cookie.service'
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from './auth.constants'

const createService = (env: Partial<Env>): AuthCookieService => {
	const config = { get: <K extends keyof Env>(key: K): Env[K] | undefined => env[key] }
	return new AuthCookieService(config as unknown as ConfigService<Env, true>)
}

const createResponse = () => {
	const cookie = vi.fn<(name: string, value: string, options: CookieOptions) => void>()
	const clearCookie = vi.fn<(name: string, options: CookieOptions) => void>()
	return { response: { cookie, clearCookie } as unknown as Response, cookie, clearCookie }
}

const getOptions = (calls: unknown[][], name: string): CookieOptions | undefined => {
	const call = calls.find(([cookieName]) => cookieName === name)
	return call?.at(-1) as CookieOptions | undefined
}

const tokens = { accessToken: 'access', refreshToken: 'refresh' }

describe('AuthCookieService', () => {
	it('marks cookies Secure in production', () => {
		const { response, cookie } = createResponse()

		createService({ NODE_ENV: 'production' }).setTokens(response, tokens)

		expect(getOptions(cookie.mock.calls, ACCESS_COOKIE_NAME)).toMatchObject({
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			path: '/api/v1',
		})
		expect(getOptions(cookie.mock.calls, REFRESH_COOKIE_NAME)).toMatchObject({
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			path: '/api/v1/auth',
		})
	})

	it('drops Secure outside production so http://localhost works', () => {
		const { response, cookie } = createResponse()

		createService({ NODE_ENV: 'development' }).setTokens(response, tokens)

		expect(getOptions(cookie.mock.calls, ACCESS_COOKIE_NAME)?.secure).toBe(false)
	})

	it('clears cookies with the same path and domain they were set with', () => {
		const { response, clearCookie } = createResponse()

		createService({ NODE_ENV: 'production', COOKIE_DOMAIN: 'kus.app' }).clearTokens(response)

		expect(getOptions(clearCookie.mock.calls, ACCESS_COOKIE_NAME)).toMatchObject({
			path: '/api/v1',
			domain: 'kus.app',
		})
		expect(getOptions(clearCookie.mock.calls, REFRESH_COOKIE_NAME)).toMatchObject({
			path: '/api/v1/auth',
			domain: 'kus.app',
		})
	})
})
