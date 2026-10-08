import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	authSessionResponseSchema,
	authUserSchema,
	createDataResponseSchema,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { createFakeAiClient } from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const ME_URL = '/api/v1/users/me'
const userResponse = createDataResponseSchema(authUserSchema)

const fake = createFakeAiClient()

describe('users/me (e2e, real DB)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)

	const start = async (): Promise<void> => {
		;({ app, prisma } = await createDbTestApp({ aiClient: fake.client }))
	}

	const registerUser = async (email: string): Promise<{ agent: TestAgent; userId: string }> => {
		const agent = request.agent(app.getHttpServer())
		const response = await agent
			.post('/api/v1/auth/register')
			.send({ email, password: 'correct-horse-battery', name: 'Bohdan', consent: true })
			.expect(201)
		const { user } = createDataResponseSchema(authSessionResponseSchema).parse(response.body).data
		return { agent, userId: user.id }
	}

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		logSpy.mockRestore()
	})

	it('sets «Як до тебе звертатися?», returns it with the user and clears it when empty', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		const set = await owner.agent.patch(ME_URL).send({ addressAs: '  Богдане  ' }).expect(200)

		expect(userResponse.parse(set.body).data).toMatchObject({
			name: 'Bohdan',
			addressAs: 'Богдане',
		})
		const me = await owner.agent.get(ME_URL).expect(200)
		expect(userResponse.parse(me.body).data.addressAs).toBe('Богдане')

		const cleared = await owner.agent.patch(ME_URL).send({ addressAs: '' }).expect(200)
		expect(userResponse.parse(cleared.body).data.addressAs).toBeNull()
	})

	it('changes only the own user', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')

		await stranger.agent.patch(ME_URL).send({ addressAs: 'Чужий' }).expect(200)

		const ownerRow = await prisma.user.findUniqueOrThrow({ where: { id: owner.userId } })
		expect(ownerRow.addressAs).toBeNull()
	})

	it('validates the length and requires auth', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		const long = await owner.agent
			.patch(ME_URL)
			.send({ addressAs: 'а'.repeat(31) })
			.expect(422)

		expect(apiErrorResponseSchema.parse(long.body)).toMatchObject({
			errorCode: 'VALIDATION_ERROR',
			details: { fields: { addressAs: 'TOO_LARGE' } },
		})
		await request(app.getHttpServer()).patch(ME_URL).send({ addressAs: 'Бо' }).expect(401)
	})
})
