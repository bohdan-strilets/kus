import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	ACCOUNT_DELETION_GRACE_DAYS,
	apiErrorResponseSchema,
	authSessionResponseSchema,
	authUserSchema,
	chatMessageSchema,
	createCursorPaginatedResponseSchema,
	createDataResponseSchema,
} from '@kus/shared'
import request, { type Response } from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { addDays, getLocalDateString } from '../src/common/time'
import { AccountPurgeService } from '../src/modules/account/account-purge.service'
import { createFakeAiClient } from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const DELETE_URL = '/api/v1/account/delete'
const RESTORE_URL = '/api/v1/account/restore'
const ME_URL = '/api/v1/users/me'
const MESSAGES_URL = '/api/v1/messages'
const PASSWORD = 'correct-horse-battery'
const MS_IN_DAY = 24 * 60 * 60 * 1000
const WELCOME_BACK_TAIL = 'Усе на місці, як і було. Пиши, що їси — я порахую.'

const userResponse = createDataResponseSchema(authUserSchema)
const sessionResponse = createDataResponseSchema(authSessionResponseSchema)
const messagesResponse = createCursorPaginatedResponseSchema(chatMessageSchema)

const fake = createFakeAiClient()

const getSetCookies = (response: Response): string[] => {
	const header = response.headers['set-cookie'] as string[] | string | undefined
	if (!header) return []
	return Array.isArray(header) ? header : [header]
}

interface TestUser {
	agent: TestAgent
	userId: string
	email: string
}

describe('account deletion (e2e, real DB)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	const logSpies = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
	]
	const today = (): string => getLocalDateString(new Date(), 'Europe/Warsaw')

	const start = async (): Promise<void> => {
		fake.reset()
		;({ app, prisma } = await createDbTestApp({ aiClient: fake.client }))
	}

	const registerUser = async (email: string, name = 'Bohdan'): Promise<TestUser> => {
		const agent = request.agent(app.getHttpServer())
		const response = await agent
			.post('/api/v1/auth/register')
			.send({ email, password: PASSWORD, name, consent: true })
			.expect(201)
		const { user } = sessionResponse.parse(response.body).data
		return { agent, userId: user.id, email }
	}

	const login = (agent: TestAgent, email: string): Promise<Response> =>
		agent.post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(200)

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('a wrong password is a 400 the form can show; nothing changes', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		const response = await owner.agent
			.post(DELETE_URL)
			.send({ password: 'wrong-password' })
			.expect(400)

		expect(apiErrorResponseSchema.parse(response.body)).toEqual({
			statusCode: 400,
			errorCode: 'PASSWORD_INCORRECT',
			details: {},
		})
		await owner.agent.get(ME_URL).expect(200)
		const user = await prisma.user.findUniqueOrThrow({ where: { id: owner.userId } })
		expect(user.purgeAt).toBeNull()
		expect(user.deletionRequestedAt).toBeNull()
	})

	it('delete → login → 403 everywhere but «who am I» → restore → access is back', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const laptop = request.agent(app.getHttpServer())
		await login(laptop, owner.email)

		const before = Date.now()
		const deleted = await owner.agent.post(DELETE_URL).send({ password: PASSWORD }).expect(204)

		// the cookies are cleared and every session is gone, the laptop's too
		expect(
			getSetCookies(deleted).every((cookie) => cookie.includes('Expires=Thu, 01 Jan 1970')),
		).toBe(true)
		await owner.agent.get(ME_URL).expect(401)
		await laptop.get(ME_URL).expect(401)
		await laptop.post('/api/v1/auth/refresh').expect(401)
		const stored = await prisma.user.findUniqueOrThrow({ where: { id: owner.userId } })
		expect(stored.deletionRequestedAt?.getTime()).toBeGreaterThanOrEqual(before)
		expect(stored.purgeAt?.getTime()).toBeCloseTo(
			(stored.deletionRequestedAt?.getTime() ?? 0) + ACCOUNT_DELETION_GRACE_DAYS * MS_IN_DAY,
			-3,
		)

		// logging in works and says the account is waiting to be purged
		const loggedIn = await login(owner.agent, owner.email)
		expect(sessionResponse.parse(loggedIn.body).data.user).toMatchObject({
			pendingDeletion: true,
			purgeAt: stored.purgeAt?.toISOString(),
		})
		const me = await owner.agent.get(ME_URL).expect(200)
		expect(userResponse.parse(me.body).data.pendingDeletion).toBe(true)

		// the data is hidden: 403 before any validation or lookup
		const blocked = await owner.agent
			.patch('/api/v1/food-entries/01999a00-0000-7000-8000-000000000001')
			.send({ grams: 100 })
			.expect(403)
		expect(apiErrorResponseSchema.parse(blocked.body)).toEqual({
			statusCode: 403,
			errorCode: 'ACCOUNT_PENDING_DELETION',
			details: { purgeAt: stored.purgeAt?.toISOString() },
		})
		await owner.agent.get(`/api/v1/days/${today()}`).expect(403)
		await owner.agent.get('/api/v1/profile').expect(403)
		// logout still works for the restore screen's «Вийти»
		await owner.agent.post('/api/v1/auth/logout').expect(204)

		await login(owner.agent, owner.email)
		const restored = await owner.agent.post(RESTORE_URL).expect(200)
		expect(userResponse.parse(restored.body).data).toMatchObject({
			pendingDeletion: false,
			purgeAt: null,
		})
		await owner.agent.get(`/api/v1/days/${today()}`).expect(200)
		const after = await prisma.user.findUniqueOrThrow({ where: { id: owner.userId } })
		expect(after.purgeAt).toBeNull()
		expect(after.deletionRequestedAt).toBeNull()

		// Kusik greets the user in the chat — without a name: «Bohdan» has no safe vocative
		const feed = await owner.agent.get(MESSAGES_URL).expect(200)
		const [welcome] = messagesResponse.parse(feed.body).data
		expect(welcome).toMatchObject({
			role: 'ASSISTANT',
			status: 'COMPLETED',
			replyToId: null,
			content: `З поверненням! ${WELCOME_BACK_TAIL}`,
			meals: [],
			clarifications: [],
		})
	})

	it('greets by name once: a repeated restore adds no second message', async () => {
		await start()
		const owner = await registerUser('owner@kus.app', 'Богдан')
		await owner.agent.post(DELETE_URL).send({ password: PASSWORD }).expect(204)
		await login(owner.agent, owner.email)

		await owner.agent.post(RESTORE_URL).expect(200)
		await owner.agent.post(RESTORE_URL).expect(200)

		const feed = await owner.agent.get(MESSAGES_URL).expect(200)
		const messages = messagesResponse.parse(feed.body).data
		expect(messages).toHaveLength(1)
		expect(messages[0]?.content).toBe(`З поверненням, Богдане! ${WELCOME_BACK_TAIL}`)
	})

	it('purges the accounts past their date, with everything they own, and leaves the rest', async () => {
		await start()
		const expired = await registerUser('expired@kus.app')
		const pending = await registerUser('pending@kus.app')
		const active = await registerUser('active@kus.app')
		await expired.agent.patch('/api/v1/profile').send({ weightKg: 80 }).expect(200)
		const now = new Date()
		await prisma.user.update({
			where: { id: expired.userId },
			data: { deletionRequestedAt: addDays(now, -31), purgeAt: addDays(now, -1) },
		})
		await prisma.user.update({
			where: { id: pending.userId },
			data: { deletionRequestedAt: now, purgeAt: addDays(now, 30) },
		})

		const purge = app.get(AccountPurgeService)
		expect(await purge.purgeExpired(new Date())).toBe(1)

		expect(await prisma.user.findUnique({ where: { id: expired.userId } })).toBeNull()
		expect(await prisma.session.count({ where: { userId: expired.userId } })).toBe(0)
		expect(await prisma.authCredentials.count({ where: { userId: expired.userId } })).toBe(0)
		expect(await prisma.weightEntry.count({ where: { userId: expired.userId } })).toBe(0)
		expect(await prisma.user.count()).toBe(2)
		await active.agent.get(ME_URL).expect(200)
		// idempotent
		expect(await purge.purgeExpired(new Date())).toBe(0)
		expect(await prisma.user.count()).toBe(2)
	})

	it('requires auth and validates the body', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		await request(app.getHttpServer()).post(DELETE_URL).send({ password: PASSWORD }).expect(401)
		await request(app.getHttpServer()).post(RESTORE_URL).expect(401)
		const empty = await owner.agent.post(DELETE_URL).send({}).expect(422)
		expect(apiErrorResponseSchema.parse(empty.body).details.fields).toEqual({
			password: 'REQUIRED',
		})
	})
})
