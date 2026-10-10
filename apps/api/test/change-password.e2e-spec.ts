import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { apiErrorResponseSchema } from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { createFakeAiClient } from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const CHANGE_URL = '/api/v1/auth/change-password'
const ME_URL = '/api/v1/users/me'
const EMAIL = 'owner@kus.app'
const OLD_PASSWORD = 'correct-horse-battery'
const NEW_PASSWORD = 'kusik-2026-nov'

const fake = createFakeAiClient()

describe('auth change-password (e2e, real DB)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	const logSpies = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
	]

	const start = async (): Promise<void> => {
		fake.reset()
		;({ app, prisma } = await createDbTestApp({ aiClient: fake.client }))
	}

	/** The phone registers; the laptop logs in as a second device. */
	const registerAndLoginTwice = async (): Promise<{ phone: TestAgent; laptop: TestAgent }> => {
		const phone = request.agent(app.getHttpServer())
		await phone
			.post('/api/v1/auth/register')
			.send({ email: EMAIL, password: OLD_PASSWORD, name: 'Bohdan', consent: true })
			.expect(201)
		const laptop = request.agent(app.getHttpServer())
		await laptop
			.post('/api/v1/auth/login')
			.send({ email: EMAIL, password: OLD_PASSWORD })
			.expect(200)
		return { phone, laptop }
	}

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('a wrong current password is a 400 and changes nothing', async () => {
		await start()
		const { phone, laptop } = await registerAndLoginTwice()
		const before = await prisma.authCredentials.findFirstOrThrow()

		const response = await phone
			.post(CHANGE_URL)
			.send({ currentPassword: 'wrong-password', newPassword: NEW_PASSWORD })
			.expect(400)

		expect(apiErrorResponseSchema.parse(response.body)).toEqual({
			statusCode: 400,
			errorCode: 'PASSWORD_INCORRECT',
			details: {},
		})
		await phone.get(ME_URL).expect(200)
		await laptop.get(ME_URL).expect(200)
		const after = await prisma.authCredentials.findFirstOrThrow()
		expect(after.passwordHash).toBe(before.passwordHash)
		// counted like a failed login
		expect(after.failedLoginAttempts).toBe(1)
	})

	it('changes the password, keeps this device and logs out the others', async () => {
		await start()
		const { phone, laptop } = await registerAndLoginTwice()

		await phone
			.post(CHANGE_URL)
			.send({ currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD })
			.expect(204)

		await phone.get(ME_URL).expect(200)
		await phone.post('/api/v1/auth/refresh').expect(204)
		await laptop.get(ME_URL).expect(401)
		await laptop.post('/api/v1/auth/refresh').expect(401)

		await request(app.getHttpServer())
			.post('/api/v1/auth/login')
			.send({ email: EMAIL, password: OLD_PASSWORD })
			.expect(401)
		await request(app.getHttpServer())
			.post('/api/v1/auth/login')
			.send({ email: EMAIL, password: NEW_PASSWORD })
			.expect(200)
		const credentials = await prisma.authCredentials.findFirstOrThrow()
		expect(credentials.passwordChangedAt.getTime()).toBeGreaterThan(credentials.createdAt.getTime())
	})

	it('rejects a new password equal to the current one and keeps every session', async () => {
		await start()
		const { phone, laptop } = await registerAndLoginTwice()

		const same = await phone
			.post(CHANGE_URL)
			.send({ currentPassword: OLD_PASSWORD, newPassword: OLD_PASSWORD })
			.expect(400)

		expect(apiErrorResponseSchema.parse(same.body)).toEqual({
			statusCode: 400,
			errorCode: 'PASSWORD_SAME',
			details: {},
		})
		await laptop.get(ME_URL).expect(200)
		// a wrong current password with the same new one still says «incorrect», not «same»
		const wrong = await phone
			.post(CHANGE_URL)
			.send({ currentPassword: 'wrong-password', newPassword: 'wrong-password' })
			.expect(400)
		expect(apiErrorResponseSchema.parse(wrong.body).errorCode).toBe('PASSWORD_INCORRECT')
	})

	it('validates the new password and requires auth', async () => {
		await start()
		const { phone } = await registerAndLoginTwice()

		const short = await phone
			.post(CHANGE_URL)
			.send({ currentPassword: OLD_PASSWORD, newPassword: 'short' })
			.expect(422)
		expect(apiErrorResponseSchema.parse(short.body).details.fields).toEqual({
			newPassword: 'TOO_SMALL',
		})
		await request(app.getHttpServer())
			.post(CHANGE_URL)
			.send({ currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD })
			.expect(401)
	})
})
