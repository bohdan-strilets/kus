import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	authSessionResponseSchema,
	createDataResponseSchema,
	uploadPhotoResponseSchema,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { PHOTOS_BODY_LIMIT_BYTES } from '../src/app.setup'
import type { PrismaService } from '../src/prisma'
import { STORAGE_ADAPTER } from '../src/modules/storage/storage.constants'
import type { StorageAdapter } from '../src/modules/storage/storage.types'
import { createCapturingLogger, createDbTestApp } from './create-db-test-app'
import { createJpeg, JPEG_SENTINEL, toBase64 } from './fixtures/jpeg'

const PHOTOS_URL = '/api/v1/photos'
const BASE64_RUN_MIN_LENGTH = 200
const BASE64_RUN = new RegExp(`[A-Za-z0-9+/=]{${BASE64_RUN_MIN_LENGTH},}`)
const FIELD_CODE = /^[A-Z][A-Z0-9_.]*$/
const SECRET_BUCKET = 'kus-secret-bucket'
const SECRET_ENDPOINT = 'https://secret-account.r2.example'
const KEY_PREFIX = 'logsafe'
const OVER_LIMIT_BYTES = 1

const fieldsSchema = z.object({ fields: z.record(z.string(), z.string()) })
const uploadResponseSchema = createDataResponseSchema(uploadPhotoResponseSchema)

const logger = createCapturingLogger()

const BASE64_BITS_PER_CHAR = 6
const BITS_PER_BYTE = 8

/** The sentinel as it looks inside base64, for each of the three byte alignments. */
const getSentinelBase64Fragments = (): string[] =>
	[0, 1, 2].map((padding) => {
		const encoded = Buffer.concat([Buffer.alloc(padding), Buffer.from(JPEG_SENTINEL)]).toString(
			'base64',
		)
		const firstWholeChar = Math.ceil((padding * BITS_PER_BYTE) / BASE64_BITS_PER_CHAR)
		return encoded.slice(firstWholeChar, -3)
	})

/** What a leaked photo or storage detail would leave behind. */
const expectNoLeakIn = (text: string, jpeg: Buffer, storageKeys: string[] = []): void => {
	expect(text).not.toContain(JPEG_SENTINEL)
	for (const fragment of getSentinelBase64Fragments()) expect(text).not.toContain(fragment)
	expect(text).not.toContain(toBase64(jpeg).slice(10, 50))
	expect(text).not.toContain('base64,')
	expect(text).not.toMatch(BASE64_RUN)
	expect(text).not.toContain(SECRET_BUCKET)
	expect(text).not.toContain(SECRET_ENDPOINT)
	expect(text).not.toContain(`${KEY_PREFIX}/users/`)
	for (const key of storageKeys) expect(text).not.toContain(key)
}

describe('photos never reach the logs or the error bodies (e2e)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	let agent: TestAgent
	let userId: string
	let storage: StorageAdapter
	const jpeg = createJpeg({ width: 1200, height: 900, hasSentinel: true })
	const thumb = createJpeg({ width: 768, height: 576, hasSentinel: true })
	const validBody = {
		photo: { mimeType: 'image/jpeg', data: toBase64(jpeg) },
		thumb: { mimeType: 'image/jpeg', data: toBase64(thumb) },
		width: 1200,
		height: 900,
	}

	const start = async (env: Record<string, string> = {}): Promise<void> => {
		;({ app, prisma } = await createDbTestApp({
			logger,
			env: { STORAGE_KEY_PREFIX: KEY_PREFIX, ...env },
		}))
		storage = app.get<StorageAdapter>(STORAGE_ADAPTER)
		agent = request.agent(app.getHttpServer())
		const response = await agent
			.post('/api/v1/auth/register')
			.send({ email: 'owner@kus.app', password: 'correct-horse-battery', name: 'T', consent: true })
			.expect(201)
		userId = createDataResponseSchema(authSessionResponseSchema).parse(response.body).data.user.id
		// startup and registration lines are not what is under test
		logger.lines.length = 0
	}

	beforeEach(() => {
		logger.lines.length = 0
	})

	afterEach(async () => {
		await app.close()
	})

	const expectClean = (response: { text: string }, bytes: Buffer = jpeg): void => {
		expectNoLeakIn(response.text, bytes)
		expectNoLeakIn(logger.lines.join('\n'), bytes)
	}

	const getFields = (response: { body: unknown }): Record<string, string> => {
		const { fields } = fieldsSchema.parse(apiErrorResponseSchema.parse(response.body).details)
		for (const code of Object.values(fields)) expect(code).toMatch(FIELD_CODE)
		return fields
	}

	const failStorage = (method: 'putObject' | 'getObject' | 'deleteObject'): void => {
		vi.spyOn(storage, method).mockImplementation((input: unknown) =>
			Promise.reject(
				new Error(
					`AccessDenied: bucket ${SECRET_BUCKET} at ${SECRET_ENDPOINT} key ${JSON.stringify(input)}`,
				),
			),
		)
	}

	it('keeps a clean log for a successful upload (the sentinel is cut, no keys or bytes)', async () => {
		await start()

		const response = await agent.post(PHOTOS_URL).send(validBody).expect(201)

		const { id } = uploadResponseSchema.parse(response.body).data
		expectClean(response)
		expect(logger.lines.some((line) => line.includes(userId) && line.includes(id))).toBe(true)
		expect(logger.lines.join('\n')).not.toContain(KEY_PREFIX)
	})

	it('422 for a broken photo and a broken thumbnail: codes only', async () => {
		await start()
		const huge = createJpeg({ width: 3000, height: 900, hasSentinel: true })
		const wideThumb = createJpeg({ width: 900, height: 576, hasSentinel: true })

		const response = await agent
			.post(PHOTOS_URL)
			.send({
				...validBody,
				photo: { mimeType: 'image/jpeg', data: toBase64(huge) },
				thumb: { mimeType: 'image/jpeg', data: toBase64(wideThumb) },
			})
			.expect(422)

		expect(getFields(response)).toEqual({ photo: 'PHOTO_INVALID', thumb: 'PHOTO_INVALID' })
		expectClean(response, huge)
		expectNoLeakIn(response.text, wideThumb)
		expectNoLeakIn(logger.lines.join('\n'), wideThumb)
	})

	it('422 for bytes that are not a JPEG', async () => {
		await start()
		const forged = Buffer.concat([
			Buffer.from('GIF89a'),
			Buffer.from(JPEG_SENTINEL),
			Buffer.alloc(80),
		])

		const response = await agent
			.post(PHOTOS_URL)
			.send({ ...validBody, photo: { mimeType: 'image/jpeg', data: toBase64(forged) } })
			.expect(422)

		expect(getFields(response)).toEqual({ photo: 'UNSUPPORTED_IMAGE' })
		expectClean(response, forged)
	})

	it('422 for data that is not base64', async () => {
		await start()

		const response = await agent
			.post(PHOTOS_URL)
			.send({
				...validBody,
				photo: { mimeType: 'image/jpeg', data: `${validBody.photo.data}!!! x` },
			})
			.expect(422)

		expect(getFields(response)).toEqual({ 'photo.data': 'INVALID_FORMAT' })
		expectClean(response)
	})

	it('413 for a body above the photos limit', async () => {
		await start()
		const body = JSON.stringify({ pad: 'A'.repeat(PHOTOS_BODY_LIMIT_BYTES + OVER_LIMIT_BYTES) })

		const response = await agent.post(PHOTOS_URL).set('Content-Type', 'application/json').send(body)

		expect(response.status).toBe(413)
		expect(response.body).toEqual({ statusCode: 413, errorCode: 'PAYLOAD_TOO_LARGE', details: {} })
		expectClean(response)
	})

	it('400 for JSON cut in the middle of the photo', async () => {
		await start()
		const cut = `{"photo":{"mimeType":"image/jpeg","data":"${validBody.photo.data}`

		const response = await agent
			.post(PHOTOS_URL)
			.set('Content-Type', 'application/json')
			.send(cut)
			.expect(400)

		expect(response.body).toEqual({ statusCode: 400, errorCode: 'BAD_REQUEST', details: {} })
		expectClean(response)
	})

	it('429 at the daily upload limit', async () => {
		await start({ PHOTO_DAILY_UPLOAD_LIMIT: '1' })
		await agent.post(PHOTOS_URL).send(validBody).expect(201)
		logger.lines.length = 0

		const response = await agent.post(PHOTOS_URL).send(validBody).expect(429)

		const error = apiErrorResponseSchema.parse(response.body)
		expect(error.errorCode).toBe('DAILY_PHOTO_LIMIT_REACHED')
		expect(Object.keys(error.details).sort()).toEqual(['limit', 'resetsAt'])
		expect(error.details).toMatchObject({ limit: 1 })
		expectClean(response)
	})

	it('503 STORAGE_UNAVAILABLE when the storage fails on upload, without bucket, endpoint or keys', async () => {
		await start()
		failStorage('putObject')

		const response = await agent.post(PHOTOS_URL).send(validBody).expect(503)

		expect(response.body).toEqual({
			statusCode: 503,
			errorCode: 'STORAGE_UNAVAILABLE',
			details: {},
		})
		expectClean(response)
		expect(logger.lines.some((line) => line.startsWith('error: Storage put failed'))).toBe(true)
	})

	it('503 on read and on delete without leaking the storage error', async () => {
		await start()
		const id = uploadResponseSchema.parse(
			(await agent.post(PHOTOS_URL).send(validBody).expect(201)).body,
		).data.id
		logger.lines.length = 0
		failStorage('getObject')
		failStorage('deleteObject')

		const read = await agent.get(`${PHOTOS_URL}/${id}`).expect(503)
		const removal = await agent.delete(`${PHOTOS_URL}/${id}`).expect(503)

		for (const response of [read, removal]) {
			expect(apiErrorResponseSchema.parse(response.body).errorCode).toBe('STORAGE_UNAVAILABLE')
			expectClean(response)
		}
	})

	it('a failed upload leaves no object and no row behind', async () => {
		await start()
		const originalPut = storage.putObject
		const put = vi.spyOn(storage, 'putObject')
		put.mockImplementationOnce(originalPut)
		put.mockRejectedValueOnce(new Error(`bucket ${SECRET_BUCKET}`))

		await agent.post(PHOTOS_URL).send(validBody).expect(503)

		const keys = put.mock.calls.map(([input]) => input.key)
		expect(keys).toHaveLength(2)
		for (const key of keys) expect(await storage.getObject(key)).toBeNull()
		expect(await prisma.storedFile.count()).toBe(0)
		expectNoLeakIn(logger.lines.join('\n'), jpeg, keys)
	})
})
