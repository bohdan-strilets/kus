import type { NestExpressApplication } from '@nestjs/platform-express'
import { apiErrorResponseSchema } from '@kus/shared'
import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'

import { createDbTestApp } from './create-db-test-app'

const SECRET = 's'.repeat(40)
const LOGIN_URL = '/api/v1/auth/login'
// 5/min on /auth/login (auth.constants): the 6th from one client is throttled
const LOGIN_LIMIT = 5
const NOT_FOUND = { statusCode: 404, errorCode: 'NOT_FOUND', details: {} }

const credentials = { email: 'nobody@kus.app', password: 'wrong-password-123' }

describe('proxy gate and client IP behind Vercel (e2e, real DB)', () => {
	let app: NestExpressApplication

	const start = async (env: Record<string, string> = {}): Promise<void> => {
		;({ app } = await createDbTestApp({ env }))
	}

	const login = (headers: Record<string, string>) => {
		const call = request(app.getHttpServer()).post(LOGIN_URL)
		for (const [key, value] of Object.entries(headers)) call.set(key, value)
		return call.send(credentials)
	}

	afterEach(async () => {
		await app.close()
	})

	it('answers 404 to a direct call without the secret or with a wrong one', async () => {
		await start({ API_PROXY_SECRET: SECRET })

		const missing = await login({}).expect(404)
		const wrong = await login({ 'x-kus-proxy-secret': 'x'.repeat(40) }).expect(404)

		expect(missing.body).toEqual(NOT_FOUND)
		expect(apiErrorResponseSchema.parse(wrong.body)).toEqual(NOT_FOUND)
	})

	it('lets the healthcheck through without the secret', async () => {
		await start({ API_PROXY_SECRET: SECRET })

		await request(app.getHttpServer()).get('/api/v1/health').expect(200)
	})

	it('throttles each client by the IP Vercel saw, not by the shared proxy IP', async () => {
		await start({ API_PROXY_SECRET: SECRET })
		const fromA = { 'x-kus-proxy-secret': SECRET, 'x-vercel-forwarded-for': '203.0.113.1' }
		const fromB = { 'x-kus-proxy-secret': SECRET, 'x-vercel-forwarded-for': '203.0.113.2' }

		for (let index = 0; index < LOGIN_LIMIT; index += 1) await login(fromA).expect(401)
		await login(fromA).expect(429)

		// another phone behind the same Vercel edge keeps its own limit
		await login(fromB).expect(401)
	})

	it('ignores a forged client IP header when no proxy is configured (local, tests)', async () => {
		await start()

		for (let index = 0; index < LOGIN_LIMIT; index += 1) {
			await login({ 'x-vercel-forwarded-for': `203.0.113.${index + 10}` }).expect(401)
		}
		// a new "IP" per request does not reset the limit: they all count as the socket's IP
		await login({ 'x-vercel-forwarded-for': '203.0.113.99' }).expect(429)
	})
})
