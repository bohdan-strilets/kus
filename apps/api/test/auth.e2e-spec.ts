import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	type ApiErrorResponse,
	authSessionResponseSchema,
	authUserSchema,
	createDataResponseSchema,
} from '@kus/shared'
import request, { type Response } from 'supertest'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { REFRESH_REUSE_GRACE_MS } from '../src/modules/auth/auth.constants'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const ACCESS_COOKIE = 'kus_access'
const REFRESH_COOKIE = 'kus_refresh'

const credentials = {
	email: 'Owner@Kus.App',
	password: 'correct-horse-battery',
	name: 'Owner',
	consent: true,
}
const normalizedEmail = 'owner@kus.app'

const meResponseSchema = createDataResponseSchema(authUserSchema)
const sessionResponseSchema = createDataResponseSchema(authSessionResponseSchema)

const parseError = (response: Response): ApiErrorResponse =>
	apiErrorResponseSchema.parse(response.body)

const getSetCookies = (response: Response): string[] => {
	const header = response.headers['set-cookie'] as string[] | string | undefined
	if (!header) return []
	return Array.isArray(header) ? header : [header]
}

const findSetCookie = (response: Response, name: string): string | undefined =>
	getSetCookies(response).find((cookie) => cookie.startsWith(`${name}=`))

/** `name=value` pair from Set-Cookie, ready to send back in a Cookie header. */
const getCookiePair = (response: Response, name: string): string => {
	const cookie = findSetCookie(response, name)
	if (!cookie) throw new Error(`Set-Cookie ${name} missing`)
	return cookie.split(';')[0] ?? ''
}

describe('auth (e2e, real DB)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	const logSpies = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
	]

	beforeEach(async () => {
		// a fresh app per test also resets the in-memory throttler
		;({ app, prisma } = await createDbTestApp())
	})

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('runs the full cycle: register → login → me → refresh → logout → me 401', async () => {
		const agent = request.agent(app.getHttpServer())

		const registered = await agent.post('/api/v1/auth/register').send(credentials).expect(201)
		expect(sessionResponseSchema.parse(registered.body).data.user.email).toBe(normalizedEmail)
		const stored = await prisma.user.findUniqueOrThrow({ where: { email: normalizedEmail } })
		expect(stored.consentAt).toBeInstanceOf(Date)

		const loggedIn = await agent
			.post('/api/v1/auth/login')
			.send({ email: credentials.email, password: credentials.password })
			.expect(200)
		expect(sessionResponseSchema.parse(loggedIn.body).data.user.email).toBe(normalizedEmail)
		const accessCookie = getCookiePair(loggedIn, ACCESS_COOKIE)

		const me = await agent.get('/api/v1/users/me').expect(200)
		const meBody = meResponseSchema.parse(me.body)
		expect(meBody.data).toMatchObject({ email: normalizedEmail, name: 'Owner', locale: 'uk' })
		expect(me.body).not.toHaveProperty('data.passwordHash')

		const refreshed = await agent.post('/api/v1/auth/refresh').expect(204)
		expect(findSetCookie(refreshed, REFRESH_COOKIE)).toBeDefined()
		await agent.get('/api/v1/users/me').expect(200)

		await agent.post('/api/v1/auth/logout').expect(204)
		const afterLogout = await agent.get('/api/v1/users/me').expect(401)
		expect(afterLogout.body).toEqual({ statusCode: 401, errorCode: 'UNAUTHORIZED', details: {} })

		// a copied access token dies with its session, not 15 minutes later
		await request(app.getHttpServer())
			.get('/api/v1/users/me')
			.set('Cookie', accessCookie)
			.expect(401)
	})

	it('sets httpOnly lax cookies, the refresh one only on /api/v1/auth', async () => {
		const response = await request(app.getHttpServer())
			.post('/api/v1/auth/register')
			.send(credentials)
			.expect(201)

		const access = findSetCookie(response, ACCESS_COOKIE)
		const refresh = findSetCookie(response, REFRESH_COOKIE)
		expect(access).toMatch(/Path=\/api\/v1;/)
		expect(access).toMatch(/HttpOnly/)
		expect(access).toMatch(/SameSite=Lax/)
		expect(refresh).toMatch(/Path=\/api\/v1\/auth;/)
		expect(refresh).toMatch(/HttpOnly/)
		expect(refresh).toMatch(/SameSite=Lax/)
	})

	it('revokes the whole family when an old refresh token comes back after the grace window', async () => {
		const agent = request.agent(app.getHttpServer())
		const registered = await agent.post('/api/v1/auth/register').send(credentials).expect(201)
		const oldRefresh = getCookiePair(registered, REFRESH_COOKIE)
		await agent.post('/api/v1/auth/refresh').expect(204)
		// time travel without waiting: the old token was used just past the grace window
		await prisma.session.updateMany({
			where: { usedAt: { not: null } },
			data: { usedAt: new Date(Date.now() - REFRESH_REUSE_GRACE_MS - 1000) },
		})

		const reused = await request(app.getHttpServer())
			.post('/api/v1/auth/refresh')
			.set('Cookie', oldRefresh)
			.expect(401)
		expect(parseError(reused).errorCode).toBe('REFRESH_TOKEN_REUSED')

		// the legitimate client's fresh tokens are dead too
		await agent.get('/api/v1/users/me').expect(401)
		const rotated = await agent.post('/api/v1/auth/refresh').expect(401)
		expect(parseError(rotated).errorCode).toBe('REFRESH_TOKEN_INVALID')

		const sessions = await prisma.session.findMany()
		expect(sessions).toHaveLength(2)
		expect(sessions.every((session) => session.revokedAt !== null)).toBe(true)
	})

	it('accepts a replay of the just-used refresh token within the grace window', async () => {
		const agent = request.agent(app.getHttpServer())
		const registered = await agent.post('/api/v1/auth/register').send(credentials).expect(201)
		const oldRefresh = getCookiePair(registered, REFRESH_COOKIE)
		// the rotation reached the server, but pretend its response got lost
		await request(app.getHttpServer())
			.post('/api/v1/auth/refresh')
			.set('Cookie', oldRefresh)
			.expect(204)

		const replayed = await request(app.getHttpServer())
			.post('/api/v1/auth/refresh')
			.set('Cookie', oldRefresh)
			.expect(204)

		await request(app.getHttpServer())
			.get('/api/v1/users/me')
			.set('Cookie', getCookiePair(replayed, ACCESS_COOKIE))
			.expect(200)
		// the agent still holds the original access token of the same, still healthy family
		await agent.get('/api/v1/users/me').expect(200)
		const sessions = await prisma.session.findMany()
		expect(sessions.some((session) => session.revokedAt !== null)).toBe(false)
	})

	it('treats a replay as reuse once the successor has been used', async () => {
		const registered = await request(app.getHttpServer())
			.post('/api/v1/auth/register')
			.send(credentials)
			.expect(201)
		const first = getCookiePair(registered, REFRESH_COOKIE)
		const second = await request(app.getHttpServer())
			.post('/api/v1/auth/refresh')
			.set('Cookie', first)
			.expect(204)
		await request(app.getHttpServer())
			.post('/api/v1/auth/refresh')
			.set('Cookie', getCookiePair(second, REFRESH_COOKIE))
			.expect(204)

		const replayed = await request(app.getHttpServer())
			.post('/api/v1/auth/refresh')
			.set('Cookie', first)
			.expect(401)
		expect(parseError(replayed).errorCode).toBe('REFRESH_TOKEN_REUSED')
		const sessions = await prisma.session.findMany()
		expect(sessions.every((session) => session.revokedAt !== null)).toBe(true)
	})

	it('logout-all cuts off every session of the user', async () => {
		await request(app.getHttpServer()).post('/api/v1/auth/register').send(credentials).expect(201)
		const phone = request.agent(app.getHttpServer())
		const laptop = request.agent(app.getHttpServer())
		const login = { email: credentials.email, password: credentials.password }
		await phone.post('/api/v1/auth/login').send(login).expect(200)
		await laptop.post('/api/v1/auth/login').send(login).expect(200)

		await phone.post('/api/v1/auth/logout-all').expect(204)

		await laptop.get('/api/v1/users/me').expect(401)
		await laptop.post('/api/v1/auth/refresh').expect(401)
	})

	it('answers the same for an unknown email and a wrong password', async () => {
		await request(app.getHttpServer()).post('/api/v1/auth/register').send(credentials).expect(201)

		const wrongPassword = await request(app.getHttpServer())
			.post('/api/v1/auth/login')
			.send({ email: credentials.email, password: 'wrong-password' })
			.expect(401)
		const unknownEmail = await request(app.getHttpServer())
			.post('/api/v1/auth/login')
			.send({ email: 'nobody@kus.app', password: 'wrong-password' })
			.expect(401)

		expect(wrongPassword.body).toEqual(unknownEmail.body)
		expect(parseError(wrongPassword).errorCode).toBe('INVALID_CREDENTIALS')
	})

	it('rejects a duplicate email in any case with 409', async () => {
		await request(app.getHttpServer()).post('/api/v1/auth/register').send(credentials).expect(201)

		const duplicate = await request(app.getHttpServer())
			.post('/api/v1/auth/register')
			.send({ ...credentials, email: 'OWNER@kus.app' })
			.expect(409)
		expect(parseError(duplicate).errorCode).toBe('EMAIL_TAKEN')
	})

	it('validates the register body with field codes', async () => {
		const response = await request(app.getHttpServer())
			.post('/api/v1/auth/register')
			.send({ email: 'not-an-email', password: 'short', name: '', consent: false })
			.expect(422)

		expect(parseError(response).details.fields).toMatchObject({
			email: 'INVALID_FORMAT',
			password: 'TOO_SMALL',
			name: 'TOO_SMALL',
			consent: 'INVALID_VALUE',
		})
	})

	it('throttles login to 5 requests per minute per IP', async () => {
		const login = { email: 'nobody@kus.app', password: 'wrong-password' }
		for (let attempt = 0; attempt < 5; attempt++) {
			await request(app.getHttpServer()).post('/api/v1/auth/login').send(login).expect(401)
		}

		const throttled = await request(app.getHttpServer())
			.post('/api/v1/auth/login')
			.send(login)
			.expect(429)
		expect(parseError(throttled).errorCode).toBe('TOO_MANY_REQUESTS')
	})

	it('locks the account after 5 wrong passwords, then rejects even the right one', async () => {
		await request(app.getHttpServer()).post('/api/v1/auth/register').send(credentials).expect(201)
		const wrong = { email: credentials.email, password: 'wrong-password' }
		for (let attempt = 0; attempt < 5; attempt++) {
			await request(app.getHttpServer()).post('/api/v1/auth/login').send(wrong).expect(401)
		}

		const stored = await prisma.authCredentials.findFirstOrThrow()
		expect(stored.lockedUntil?.getTime()).toBeGreaterThan(Date.now())
		expect(stored.failedLoginAttempts).toBe(0)

		// a second app keeps the DB but has a fresh throttler, so the 6th login reaches the lock
		const { app: secondApp } = await createDbTestApp({ shouldResetDatabase: false })
		try {
			const locked = await request(secondApp.getHttpServer())
				.post('/api/v1/auth/login')
				.send({ email: credentials.email, password: credentials.password })
				.expect(423)
			expect(parseError(locked)).toEqual({
				statusCode: 423,
				errorCode: 'ACCOUNT_LOCKED',
				details: { lockedUntil: stored.lockedUntil?.toISOString() },
			})
		} finally {
			await secondApp.close()
		}
	})

	it('serves both of two parallel refreshes with the same token (grace), without revoking', async () => {
		const registered = await request(app.getHttpServer())
			.post('/api/v1/auth/register')
			.send(credentials)
			.expect(201)
		const refreshCookie = getCookiePair(registered, REFRESH_COOKIE)

		const responses = await Promise.all(
			[0, 1].map(() =>
				request(app.getHttpServer()).post('/api/v1/auth/refresh').set('Cookie', refreshCookie),
			),
		)

		expect(responses.map(({ status }) => status)).toEqual([204, 204])
		for (const response of responses) {
			await request(app.getHttpServer())
				.get('/api/v1/users/me')
				.set('Cookie', getCookiePair(response, ACCESS_COOKIE))
				.expect(200)
		}
		// one rotation + one grace sibling; the grace lock kept it from issuing a third
		const sessions = await prisma.session.findMany()
		expect(sessions).toHaveLength(3)
		expect(sessions.some((session) => session.revokedAt !== null)).toBe(false)
	})

	it('clears both cookies when the refresh token is dead', async () => {
		const response = await request(app.getHttpServer())
			.post('/api/v1/auth/refresh')
			.set('Cookie', `${REFRESH_COOKIE}=unknown-token`)
			.expect(401)

		expect(findSetCookie(response, ACCESS_COOKIE)).toMatch(/Expires=Thu, 01 Jan 1970/)
		expect(findSetCookie(response, REFRESH_COOKIE)).toMatch(/Expires=Thu, 01 Jan 1970/)
	})

	it('requires an access token for /users/me', async () => {
		await request(app.getHttpServer()).get('/api/v1/users/me').expect(401)
		await request(app.getHttpServer())
			.get('/api/v1/users/me')
			.set('Cookie', `${ACCESS_COOKIE}=not-a-jwt`)
			.expect(401)
	})
})

describe('auth registration disabled (e2e, real DB)', () => {
	let app: NestExpressApplication

	beforeEach(async () => {
		;({ app } = await createDbTestApp({ env: { ALLOW_REGISTRATION: 'false' } }))
	})

	afterEach(async () => {
		await app.close()
	})

	it('answers 403 REGISTRATION_DISABLED before validating the body', async () => {
		const valid = await request(app.getHttpServer())
			.post('/api/v1/auth/register')
			.send(credentials)
			.expect(403)
		expect(valid.body).toEqual({
			statusCode: 403,
			errorCode: 'REGISTRATION_DISABLED',
			details: {},
		})

		await request(app.getHttpServer()).post('/api/v1/auth/register').send({}).expect(403)
	})
})
