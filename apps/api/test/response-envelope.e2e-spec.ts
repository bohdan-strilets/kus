import { Controller, Get, type INestApplication } from '@nestjs/common'
import { createPaginatedResponseSchema } from '@kus/shared'
import request from 'supertest'
import type { App } from 'supertest/types'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { Public } from '../src/common/decorators'
import { paginate, type PaginatedResult } from '../src/common/pagination'
import { createTestApp } from './create-test-app'

const items = [{ id: 'a' }, { id: 'b' }]

@Public()
@Controller('test-envelope')
class TestEnvelopeController {
	@Get('list')
	getList(): PaginatedResult<{ id: string }> {
		return paginate({ items, total: 41, page: 2, limit: 20 })
	}

	@Get('empty-list')
	getEmptyList(): PaginatedResult<{ id: string }> {
		return paginate({ items: [], total: 0, page: 1, limit: 20 })
	}
}

describe('response envelope', () => {
	let app: INestApplication<App>

	beforeAll(async () => {
		app = await createTestApp({ controllers: [TestEnvelopeController] })
	})

	afterAll(async () => {
		await app.close()
	})

	it('returns a paginated result as { data, meta } without double wrapping', async () => {
		const response = await request(app.getHttpServer())
			.get('/api/v1/test-envelope/list')
			.expect(200)

		const body = createPaginatedResponseSchema(z.object({ id: z.string() })).parse(response.body)
		expect(body).toEqual({ data: items, meta: { total: 41, page: 2, limit: 20, totalPages: 3 } })
	})

	it('returns an empty page with totalPages 0', async () => {
		const response = await request(app.getHttpServer())
			.get('/api/v1/test-envelope/empty-list')
			.expect(200)

		expect(response.body).toEqual({
			data: [],
			meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
		})
	})
})
