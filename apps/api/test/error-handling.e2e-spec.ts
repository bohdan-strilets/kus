import {
	Body,
	Controller,
	Get,
	HttpStatus,
	type INestApplication,
	Logger,
	Post,
} from '@nestjs/common'
import { foodEntrySchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'
import request from 'supertest'
import type { App } from 'supertest/types'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { Public } from '../src/common/decorators'
import { AppException, ErrorCodes } from '../src/common/exceptions'
import { Prisma } from '../src/generated/prisma/client'
import { createTestApp } from './create-test-app'

// above express' default 100 kb JSON limit
const OVERSIZED_BODY_BYTES = 200 * 1024

const validEntry = {
	name: 'Гречка варена',
	grams: 200,
	quantity: null,
	kcal: 220,
	protein: 8,
	fat: 2,
	carbs: 42,
	fiber: null,
	category: 'porridge',
	source: 'ESTIMATE',
	confidence: 0.8,
	assumption: null,
	memoryRef: null,
}

class FoodEntryDto extends createZodDto(foodEntrySchema) {}

@Public()
@Controller('test-errors')
class TestErrorsController {
	@Post('food-entries')
	createEntry(@Body() body: FoodEntryDto): FoodEntryDto {
		return body
	}

	@Get('app-exception')
	throwAppException(): never {
		throw new AppException({
			status: HttpStatus.CONFLICT,
			errorCode: ErrorCodes.CONFLICT,
			details: { reason: 'duplicate' },
		})
	}

	@Get('upstream-unauthorized')
	throwUpstreamError(): never {
		// shaped like an axios/openai SDK error: numeric status, but not an http-errors object
		throw Object.assign(new Error('OpenRouter rejected the API key'), { status: 401 })
	}

	@Get('expected-unavailable')
	throwExpectedUnavailable(): never {
		throw new AppException({
			status: HttpStatus.SERVICE_UNAVAILABLE,
			errorCode: ErrorCodes.AI_UNAVAILABLE,
		})
	}

	@Get('prisma-error')
	throwPrismaError(): never {
		// Prisma quotes query arguments in its messages — here a user's food
		throw new Prisma.PrismaClientKnownRequestError(
			'Unique constraint failed: "Борщ з пампушками"',
			{
				code: 'P2002',
				clientVersion: 'test',
			},
		)
	}

	@Get('unexpected')
	throwUnexpected(): never {
		throw new Error('database exploded')
	}
}

describe('API error handling', () => {
	let app: INestApplication<App>
	const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
	const logWarn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)

	beforeAll(async () => {
		app = await createTestApp({ controllers: [TestErrorsController] })
	})

	afterEach(() => {
		logError.mockClear()
		logWarn.mockClear()
	})

	afterAll(async () => {
		await app.close()
		logError.mockRestore()
		logWarn.mockRestore()
	})

	const post = (body: unknown) =>
		request(app.getHttpServer())
			.post('/api/v1/test-errors/food-entries')
			.send(body as object)

	it('passes a valid body through and wraps it in { data }', async () => {
		const response = await post(validEntry).expect(201)

		expect(response.body).toEqual({ data: validEntry })
	})

	it('returns 422 with a field code for schema violations', async () => {
		const response = await post({ ...validEntry, grams: 6000, fat: -1 }).expect(422)

		expect(response.body).toEqual({
			statusCode: 422,
			errorCode: 'VALIDATION_ERROR',
			details: { fields: { grams: 'TOO_LARGE', fat: 'TOO_SMALL' } },
		})
	})

	it('returns REQUIRED for a missing field and INVALID_TYPE for a wrong type', async () => {
		const { name: _omitted, ...withoutName } = validEntry
		const response = await post({ ...withoutName, grams: null }).expect(422)

		expect(response.body).toEqual({
			statusCode: 422,
			errorCode: 'VALIDATION_ERROR',
			details: { fields: { name: 'REQUIRED', grams: 'INVALID_TYPE' } },
		})
	})

	it('keeps the error code from .refine() checks', async () => {
		const response = await post({ ...validEntry, grams: 10, kcal: 100 }).expect(422)

		expect(response.body).toEqual({
			statusCode: 422,
			errorCode: 'VALIDATION_ERROR',
			details: { fields: { kcal: 'KCAL_DENSITY_TOO_HIGH' } },
		})
	})

	it('returns AppException code and details as is', async () => {
		const response = await request(app.getHttpServer())
			.get('/api/v1/test-errors/app-exception')
			.expect(409)

		expect(response.body).toEqual({
			statusCode: 409,
			errorCode: 'CONFLICT',
			details: { reason: 'duplicate' },
		})
		expect(logError).not.toHaveBeenCalled()
	})

	it('returns 400 BAD_REQUEST for malformed JSON without logging an error', async () => {
		const response = await request(app.getHttpServer())
			.post('/api/v1/test-errors/food-entries')
			.set('Content-Type', 'application/json')
			.send('{"name":')
			.expect(400)

		expect(response.body).toEqual({ statusCode: 400, errorCode: 'BAD_REQUEST', details: {} })
		expect(logError).not.toHaveBeenCalled()
	})

	it('returns 413 PAYLOAD_TOO_LARGE for an oversized body without logging an error', async () => {
		const response = await post({ ...validEntry, name: 'x'.repeat(OVERSIZED_BODY_BYTES) }).expect(
			413,
		)

		expect(response.body).toEqual({
			statusCode: 413,
			errorCode: 'PAYLOAD_TOO_LARGE',
			details: {},
		})
		expect(logError).not.toHaveBeenCalled()
	})

	it('returns 500 INTERNAL_ERROR without leaking internals and logs it', async () => {
		const response = await request(app.getHttpServer())
			.get('/api/v1/test-errors/unexpected')
			.expect(500)

		expect(response.body).toEqual({ statusCode: 500, errorCode: 'INTERNAL_ERROR', details: {} })
		expect(JSON.stringify(response.body)).not.toContain('database exploded')
		expect(logError).toHaveBeenCalledOnce()
	})

	it('logs an expected 5xx AppException as a warning without a stack', async () => {
		const response = await request(app.getHttpServer())
			.get('/api/v1/test-errors/expected-unavailable')
			.expect(503)

		expect(response.body).toEqual({ statusCode: 503, errorCode: 'AI_UNAVAILABLE', details: {} })
		expect(logError).not.toHaveBeenCalled()
		expect(logWarn.mock.calls).toEqual([['Request failed (AI_UNAVAILABLE)']])
	})

	it('logs a Prisma error by class and code only, never its message', async () => {
		await request(app.getHttpServer()).get('/api/v1/test-errors/prisma-error').expect(500)

		expect(logError).toHaveBeenCalledOnce()
		const logged = JSON.stringify(logError.mock.calls)
		expect(logged).toContain('PrismaClientKnownRequestError P2002')
		expect(logged).not.toContain('Борщ')
	})

	it('treats an upstream SDK error with a 4xx status as our 500, not the client’s 401', async () => {
		const response = await request(app.getHttpServer())
			.get('/api/v1/test-errors/upstream-unauthorized')
			.expect(500)

		expect(response.body).toEqual({ statusCode: 500, errorCode: 'INTERNAL_ERROR', details: {} })
		expect(logError).toHaveBeenCalledOnce()
	})

	it('returns CLIENT_ERROR for a 4xx without a dedicated code', async () => {
		const response = await request(app.getHttpServer())
			.post('/api/v1/test-errors/food-entries')
			.set('Content-Type', 'application/json')
			.set('Content-Encoding', 'unsupported-encoding')
			.send(JSON.stringify(validEntry))
			.expect(415)

		expect(response.body).toEqual({ statusCode: 415, errorCode: 'CLIENT_ERROR', details: {} })
	})
})
