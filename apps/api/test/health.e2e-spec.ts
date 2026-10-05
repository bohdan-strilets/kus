import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { createDataResponseSchema, healthResponseSchema } from '@kus/shared'
import request from 'supertest'
import type { App } from 'supertest/types'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AppModule } from '../src/app.module'
import { setupApp } from '../src/app.setup'
import { PrismaService } from '../src/prisma'

describe('GET /api/v1/health', () => {
	let app: INestApplication<App>

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
			// health doesn't touch the DB; this keeps the test runnable without Postgres
			.overrideProvider(PrismaService)
			.useValue({})
			.compile()

		app = moduleRef.createNestApplication()
		setupApp(app)
		await app.init()
	})

	afterAll(async () => {
		await app.close()
	})

	it('returns ok wrapped in { data }', async () => {
		const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200)

		const body = createDataResponseSchema(healthResponseSchema).parse(response.body)
		expect(body.data.status).toBe('ok')
	})

	it('returns the API error format for unknown routes', async () => {
		const response = await request(app.getHttpServer()).get('/api/v1/unknown').expect(404)

		expect(response.body).toEqual({ statusCode: 404, errorCode: 'NOT_FOUND', details: {} })
	})
})
