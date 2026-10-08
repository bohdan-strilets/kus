import type { INestApplication } from '@nestjs/common'
import { createDataResponseSchema, healthResponseSchema } from '@kus/shared'
import request from 'supertest'
import type { App } from 'supertest/types'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestApp } from './create-test-app'

describe('GET /api/v1/health', () => {
	let app: INestApplication<App>

	beforeAll(async () => {
		app = await createTestApp()
	})

	afterAll(async () => {
		await app.close()
	})

	it('returns ok wrapped in { data }', async () => {
		const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200)

		const body = createDataResponseSchema(healthResponseSchema).parse(response.body)
		expect(body.data.status).toBe('ok')
	})

	it('answers 503 when the database is unreachable, so the deploy is not promoted', async () => {
		const downApp = await createTestApp({ isDatabaseUp: false })
		try {
			const response = await request(downApp.getHttpServer()).get('/api/v1/health').expect(503)
			expect(response.body).toEqual({
				statusCode: 503,
				errorCode: 'SERVICE_UNAVAILABLE',
				details: {},
			})
		} finally {
			await downApp.close()
		}
	})

	it('returns the API error format for unknown routes', async () => {
		const response = await request(app.getHttpServer()).get('/api/v1/unknown').expect(404)

		expect(response.body).toEqual({ statusCode: 404, errorCode: 'NOT_FOUND', details: {} })
	})
})
