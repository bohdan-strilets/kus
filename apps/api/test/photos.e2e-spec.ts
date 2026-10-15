import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	authSessionResponseSchema,
	createDataResponseSchema,
	PHOTO_MAX_BYTES,
	uploadPhotoResponseSchema,
} from '@kus/shared'
import request, { type Response } from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { PHOTOS_BODY_LIMIT_BYTES } from '../src/app.setup'
import type { PrismaService } from '../src/prisma'
import { STORAGE_ADAPTER } from '../src/modules/storage/storage.constants'
import type { StorageAdapter } from '../src/modules/storage/storage.types'
import { createDbTestApp } from './create-db-test-app'
import { createJpeg, JPEG_SENTINEL, toBase64 } from './fixtures/jpeg'

const PHOTOS_URL = '/api/v1/photos'
const KEY_PREFIX = 'e2e'
const APP1_MARKER = 0xe1
const MARKER_PREFIX = 0xff
const UNKNOWN_ID = '0192a000-0000-7000-8000-00000000dead'
const UPLOAD_THROTTLE_LIMIT = 30
const READ_THROTTLE_LIMIT = 600
const DEFAULT_THROTTLE_LIMIT = 100
const MAX_RESET_DISTANCE_MS = 25 * 60 * 60 * 1000
const OVER_BODY_LIMIT_BYTES = 1

const uploadResponseSchema = createDataResponseSchema(uploadPhotoResponseSchema)

const FULL_JPEG = createJpeg({ width: 1200, height: 900 })
const THUMB_JPEG = createJpeg({ width: 768, height: 576 })

interface TestUser {
	agent: TestAgent
	userId: string
}

const hasMarker = (bytes: Buffer, marker: number): boolean =>
	bytes.some((byte, index) => byte === MARKER_PREFIX && bytes[index + 1] === marker)

const createUploadBody = (
	photo: Buffer = createJpeg({ width: 1200, height: 900, hasSentinel: true }),
	thumb: Buffer = THUMB_JPEG,
) => ({
	photo: { mimeType: 'image/jpeg', data: toBase64(photo) },
	thumb: { mimeType: 'image/jpeg', data: toBase64(thumb) },
	width: 1200,
	height: 900,
})

/** supertest only buffers some content types; this one collects any body as bytes. */
const collectBytes = (res: Response, done: (error: Error | null, body: Buffer) => void): void => {
	const stream = res as unknown as NodeJS.ReadableStream
	const chunks: Buffer[] = []
	stream.on('data', (chunk: Buffer) => {
		chunks.push(chunk)
	})
	stream.on('end', () => {
		done(null, Buffer.concat(chunks))
	})
}

const createJsonBodyOfSize = (totalBytes: number): Buffer => {
	const head = '{"pad":"'
	const tail = '"}'
	const fill = totalBytes - head.length - tail.length
	return Buffer.from(`${head}${'A'.repeat(fill)}${tail}`)
}

describe('photos (e2e, real DB, memory storage)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	let storage: StorageAdapter
	vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
	vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
	vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)

	const start = async (env: Record<string, string> = {}): Promise<void> => {
		;({ app, prisma } = await createDbTestApp({ env: { STORAGE_KEY_PREFIX: KEY_PREFIX, ...env } }))
		storage = app.get<StorageAdapter>(STORAGE_ADAPTER)
	}

	const registerUser = async (email: string): Promise<TestUser> => {
		const agent = request.agent(app.getHttpServer())
		const response = await agent
			.post('/api/v1/auth/register')
			.send({ email, password: 'correct-horse-battery', name: 'Test', consent: true })
			.expect(201)
		const { user } = createDataResponseSchema(authSessionResponseSchema).parse(response.body).data
		return { agent, userId: user.id }
	}

	const upload = async (user: TestUser, body: unknown = createUploadBody()): Promise<string> => {
		const response = await user.agent
			.post(PHOTOS_URL)
			.send(body as object)
			.expect(201)
		return uploadResponseSchema.parse(response.body).data.id
	}

	const download = (user: TestUser, id: string, query = '') =>
		user.agent.get(`${PHOTOS_URL}/${id}${query}`).buffer(true).parse(collectBytes)

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		vi.restoreAllMocks()
	})

	describe('POST /photos', () => {
		it('answers 401 without a token', async () => {
			await start()

			const response = await request(app.getHttpServer())
				.post(PHOTOS_URL)
				.send(createUploadBody())
				.expect(401)

			expect(await prisma.storedFile.count()).toBe(0)
			expect(apiErrorResponseSchema.parse(response.body).statusCode).toBe(401)
		})

		it('stores a photo and its thumbnail and answers with the real size', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')

			const response = await owner.agent
				.post(PHOTOS_URL)
				// the sizes in the body are a claim; the bytes decide
				.send({ ...createUploadBody(), width: 2000, height: 2000 })
				.expect(201)

			const { data } = uploadResponseSchema.parse(response.body)
			expect(data).toMatchObject({ width: 1200, height: 900 })
			const row = await prisma.storedFile.findUniqueOrThrow({ where: { id: data.id } })
			expect(row).toMatchObject({
				userId: owner.userId,
				kind: 'MESSAGE_PHOTO',
				mimeType: 'image/jpeg',
				width: 1200,
				height: 900,
			})
			const userPrefix = `${KEY_PREFIX}/users/${owner.userId}/photos/`
			expect(row.storageKey).toBe(`${userPrefix}${data.id}`)
			expect(row.thumbKey).toBe(`${userPrefix}${data.id}-thumb`)
			const full = await storage.getObject(row.storageKey)
			const thumb = await storage.getObject(row.thumbKey)
			expect(full?.body.length).toBe(row.sizeBytes)
			expect(thumb?.body.length).toBe(row.thumbSizeBytes)
			expect(full?.body.includes(JPEG_SENTINEL)).toBe(false)
		})

		it('answers 422 UNSUPPORTED_IMAGE for a PNG sent as the photo', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const png = Buffer.concat([
				Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
				Buffer.alloc(64),
			])

			const response = await owner.agent.post(PHOTOS_URL).send(createUploadBody(png)).expect(422)

			expect(apiErrorResponseSchema.parse(response.body)).toMatchObject({
				errorCode: 'VALIDATION_ERROR',
				details: { fields: { photo: 'UNSUPPORTED_IMAGE' } },
			})
			expect(await prisma.storedFile.count()).toBe(0)
		})

		it('answers 422 for a PNG declared as a PNG (only JPEG is accepted)', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const body = createUploadBody()

			const response = await owner.agent
				.post(PHOTOS_URL)
				.send({ ...body, photo: { ...body.photo, mimeType: 'image/png' } })
				.expect(422)

			expect(apiErrorResponseSchema.parse(response.body).errorCode).toBe('VALIDATION_ERROR')
			expect(await prisma.storedFile.count()).toBe(0)
		})

		it('reports the thumbnail side beyond the limit on the thumb field', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')

			const response = await owner.agent
				.post(PHOTOS_URL)
				.send(createUploadBody(FULL_JPEG, createJpeg({ width: 769, height: 576 })))
				.expect(422)

			expect(apiErrorResponseSchema.parse(response.body).details).toEqual({
				fields: { thumb: 'PHOTO_INVALID' },
			})
		})

		it('reports a full photo one byte over the limit as PHOTO_TOO_LARGE and two bytes as TOO_LARGE', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const padded = (bytes: number) =>
				createUploadBody(Buffer.concat([FULL_JPEG, Buffer.alloc(bytes - FULL_JPEG.length)]))

			const atLimit = await owner.agent.post(PHOTOS_URL).send(padded(PHOTO_MAX_BYTES))
			const oneOver = await owner.agent.post(PHOTOS_URL).send(padded(PHOTO_MAX_BYTES + 1))
			const twoOver = await owner.agent.post(PHOTOS_URL).send(padded(PHOTO_MAX_BYTES + 2))

			expect(atLimit.status).toBe(201)
			expect(oneOver.status).toBe(422)
			expect(apiErrorResponseSchema.parse(oneOver.body).details).toEqual({
				fields: { photo: 'PHOTO_TOO_LARGE' },
			})
			expect(twoOver.status).toBe(422)
			expect(apiErrorResponseSchema.parse(twoOver.body).details).toEqual({
				fields: { 'photo.data': 'TOO_LARGE' },
			})
			expect(await prisma.storedFile.count()).toBe(1)
		})

		it.each([
			['an empty object', {}],
			[
				'a missing thumb',
				{ photo: { mimeType: 'image/jpeg', data: 'AAAA' }, width: 100, height: 100 },
			],
			[
				'data that is not base64',
				{ ...createUploadBody(), photo: { mimeType: 'image/jpeg', data: '!!!' } },
			],
			['sizes out of range', { ...createUploadBody(), width: 5 }],
		])('answers 422 for %s', async (_name, body) => {
			await start()
			const owner = await registerUser('owner@kus.app')

			const response = await owner.agent
				.post(PHOTOS_URL)
				.set('Content-Type', 'application/json')
				.send(JSON.stringify(body))

			expect(response.status).toBe(422)
			expect(apiErrorResponseSchema.parse(response.body).errorCode).toBe('VALIDATION_ERROR')
			expect(await prisma.storedFile.count()).toBe(0)
		})

		it('answers 400 to a JSON body that is not an object', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')

			await owner.agent
				.post(PHOTOS_URL)
				.set('Content-Type', 'application/json')
				.send('"photo"')
				.expect(400)
		})

		it('keeps the objects of every user under their own prefix', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const stranger = await registerUser('stranger@kus.app')

			await upload(owner)
			await upload(stranger)

			const rows = await prisma.storedFile.findMany()
			expect(rows).toHaveLength(2)
			for (const row of rows) {
				const prefix = `${KEY_PREFIX}/users/${row.userId}/photos/`
				expect(row.storageKey.startsWith(prefix)).toBe(true)
				expect(row.thumbKey.startsWith(prefix)).toBe(true)
			}
		})
	})

	describe('GET /photos/:id', () => {
		it('answers 401 without a token', async () => {
			await start()

			await request(app.getHttpServer()).get(`${PHOTOS_URL}/${UNKNOWN_ID}`).expect(401)
		})

		it('returns raw bytes without metadata, unwrapped, with cache and nosniff headers', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const id = await upload(owner)

			const response = await download(owner, id).expect(200)

			const bytes = response.body as Buffer
			expect(Buffer.isBuffer(bytes)).toBe(true)
			expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]))
			expect(hasMarker(bytes, APP1_MARKER)).toBe(false)
			expect(bytes.includes(JPEG_SENTINEL)).toBe(false)
			expect(bytes.toString('utf8').startsWith('{"data"')).toBe(false)
			expect(response.headers['content-type']).toBe('image/jpeg')
			expect(response.headers['content-length']).toBe(String(bytes.length))
			expect(response.headers['x-content-type-options']).toBe('nosniff')
			expect(response.headers['cache-control']).toBe('private, max-age=31536000, immutable')
		})

		it('returns the thumbnail for variant=thumb and the full photo by default and for variant=full', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const id = await upload(owner, createUploadBody(FULL_JPEG, THUMB_JPEG))

			const thumb = (await download(owner, id, '?variant=thumb').expect(200)).body as Buffer
			const full = (await download(owner, id, '?variant=full').expect(200)).body as Buffer
			const byDefault = (await download(owner, id).expect(200)).body as Buffer

			expect(thumb.equals(THUMB_JPEG)).toBe(true)
			expect(full.equals(FULL_JPEG)).toBe(true)
			expect(byDefault.equals(full)).toBe(true)
		})

		it('answers 422 for an unknown variant and for an id that is not a uuid', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const id = await upload(owner)

			await owner.agent.get(`${PHOTOS_URL}/${id}?variant=huge`).expect(422)
			await owner.agent.get(`${PHOTOS_URL}/not-a-uuid`).expect(422)
		})

		it('answers a missing id with 404 PHOTO_NOT_FOUND and no immutable cache header', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')

			const response = await owner.agent.get(`${PHOTOS_URL}/${UNKNOWN_ID}`).expect(404)

			expect(response.body).toEqual({ statusCode: 404, errorCode: 'PHOTO_NOT_FOUND', details: {} })
			expect(response.headers['cache-control'] ?? '').not.toContain('immutable')
		})

		it('answers 404 when the row is there but its object is gone', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const id = await upload(owner)
			const row = await prisma.storedFile.findUniqueOrThrow({ where: { id } })
			await storage.deleteObject(row.thumbKey)

			const thumb = await download(owner, id, '?variant=thumb').expect(404)
			await download(owner, id).expect(200)

			expect(thumb.headers['cache-control'] ?? '').not.toContain('immutable')
		})
	})

	describe('IDOR', () => {
		it('answers GET and DELETE of another user photo exactly like a missing id', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const stranger = await registerUser('stranger@kus.app')
			const id = await upload(owner)

			const foreignGet = await stranger.agent.get(`${PHOTOS_URL}/${id}`).expect(404)
			const foreignThumb = await stranger.agent.get(`${PHOTOS_URL}/${id}?variant=thumb`).expect(404)
			const foreignDelete = await stranger.agent.delete(`${PHOTOS_URL}/${id}`).expect(404)
			const missingGet = await stranger.agent.get(`${PHOTOS_URL}/${UNKNOWN_ID}`).expect(404)
			const missingDelete = await stranger.agent.delete(`${PHOTOS_URL}/${UNKNOWN_ID}`).expect(404)

			expect(foreignGet.body).toEqual({
				statusCode: 404,
				errorCode: 'PHOTO_NOT_FOUND',
				details: {},
			})
			expect(foreignThumb.body).toEqual(foreignGet.body)
			expect(foreignDelete.body).toEqual(foreignGet.body)
			expect(missingGet.body).toEqual(foreignGet.body)
			expect(missingDelete.body).toEqual(foreignGet.body)
			// the owner still has everything
			const row = await prisma.storedFile.findUniqueOrThrow({ where: { id } })
			expect(await storage.getObject(row.storageKey)).not.toBeNull()
			expect(await storage.getObject(row.thumbKey)).not.toBeNull()
			await download(owner, id).expect(200)
		})

		it('does not answer 409 for another user photo that a message uses (no probing)', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const stranger = await registerUser('stranger@kus.app')
			const id = await upload(owner)
			await attachToMessage(owner.userId, id)

			const response = await stranger.agent.delete(`${PHOTOS_URL}/${id}`).expect(404)

			expect(apiErrorResponseSchema.parse(response.body).errorCode).toBe('PHOTO_NOT_FOUND')
		})
	})

	const attachToMessage = async (userId: string, fileId: string): Promise<void> => {
		const message = await prisma.message.create({
			data: { userId, role: 'USER', content: 'photo', status: 'COMPLETED' },
		})
		await prisma.messageAttachment.create({
			data: {
				messageId: message.id,
				mimeType: 'image/jpeg',
				width: 1200,
				height: 900,
				sizeBytes: 1000,
				status: 'PROCESSED',
				fileId,
			},
		})
	}

	describe('DELETE /photos/:id', () => {
		it('answers 401 without a token', async () => {
			await start()

			await request(app.getHttpServer()).delete(`${PHOTOS_URL}/${UNKNOWN_ID}`).expect(401)
		})

		it('deletes an unattached photo with both objects, then GET answers 404', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const id = await upload(owner)
			const row = await prisma.storedFile.findUniqueOrThrow({ where: { id } })

			const response = await owner.agent.delete(`${PHOTOS_URL}/${id}`).expect(204)

			expect(response.text).toBe('')
			expect(await storage.getObject(row.storageKey)).toBeNull()
			expect(await storage.getObject(row.thumbKey)).toBeNull()
			expect(await prisma.storedFile.count()).toBe(0)
			await owner.agent.get(`${PHOTOS_URL}/${id}`).expect(404)
			await owner.agent.get(`${PHOTOS_URL}/${id}?variant=thumb`).expect(404)
		})

		it('answers 404, not 5xx, to a repeated delete', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const id = await upload(owner)
			await owner.agent.delete(`${PHOTOS_URL}/${id}`).expect(204)

			const again = await owner.agent.delete(`${PHOTOS_URL}/${id}`).expect(404)

			expect(apiErrorResponseSchema.parse(again.body).errorCode).toBe('PHOTO_NOT_FOUND')
		})

		it('never answers 5xx to parallel deletes of the same photo', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const id = await upload(owner)

			const responses = await Promise.all(
				Array.from({ length: 4 }, () => owner.agent.delete(`${PHOTOS_URL}/${id}`)),
			)

			for (const response of responses) expect([204, 404]).toContain(response.status)
			expect(responses.some((response) => response.status === 204)).toBe(true)
			expect(await prisma.storedFile.count()).toBe(0)
		})

		it('answers 409 PHOTO_IN_USE for a photo a message uses and keeps it intact', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const id = await upload(owner)
			await attachToMessage(owner.userId, id)
			const row = await prisma.storedFile.findUniqueOrThrow({ where: { id } })

			const response = await owner.agent.delete(`${PHOTOS_URL}/${id}`).expect(409)

			expect(response.body).toEqual({ statusCode: 409, errorCode: 'PHOTO_IN_USE', details: {} })
			expect(await storage.getObject(row.storageKey)).not.toBeNull()
			expect(await storage.getObject(row.thumbKey)).not.toBeNull()
			await download(owner, id).expect(200)
		})
	})

	describe('limits', () => {
		it('answers 429 with resetsAt when the daily upload limit is used up', async () => {
			await start({ PHOTO_DAILY_UPLOAD_LIMIT: '2' })
			const owner = await registerUser('owner@kus.app')
			await upload(owner)
			await upload(owner)
			const before = Date.now()

			const response = await owner.agent.post(PHOTOS_URL).send(createUploadBody()).expect(429)

			const error = apiErrorResponseSchema.parse(response.body)
			expect(error.errorCode).toBe('DAILY_PHOTO_LIMIT_REACHED')
			const details = error.details as { limit: number; resetsAt: string }
			expect(details.limit).toBe(2)
			const resetsAt = new Date(details.resetsAt)
			expect(resetsAt.toISOString()).toBe(details.resetsAt)
			expect(resetsAt.getTime()).toBeGreaterThan(before)
			expect(resetsAt.getTime() - before).toBeLessThanOrEqual(MAX_RESET_DISTANCE_MS)
			expect(await prisma.storedFile.count()).toBe(2)
		})

		it('counts the upload limit per user', async () => {
			await start({ PHOTO_DAILY_UPLOAD_LIMIT: '1' })
			const owner = await registerUser('owner@kus.app')
			const other = await registerUser('other@kus.app')
			await upload(owner)

			await owner.agent.post(PHOTOS_URL).send(createUploadBody()).expect(429)
			await other.agent.post(PHOTOS_URL).send(createUploadBody()).expect(201)
		})

		it('does not count photos of earlier days', async () => {
			await start({ PHOTO_DAILY_UPLOAD_LIMIT: '1' })
			const owner = await registerUser('owner@kus.app')
			const id = await upload(owner)
			await prisma.storedFile.update({
				where: { id },
				data: { createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
			})

			await owner.agent.post(PHOTOS_URL).send(createUploadBody()).expect(201)
		})

		it('answers 429 when the AI photo limit is used up, with the AI limit and resetsAt', async () => {
			await start({ AI_DAILY_PHOTO_LIMIT: '2', PHOTO_DAILY_UPLOAD_LIMIT: '50' })
			const owner = await registerUser('owner@kus.app')
			const user = await prisma.user.findUniqueOrThrow({ where: { id: owner.userId } })
			const today = new Date(
				`${new Intl.DateTimeFormat('en-CA', { timeZone: user.timezone }).format(new Date())}T00:00:00Z`,
			)
			await prisma.dailyUsage.create({
				data: { userId: owner.userId, localDate: today, photoCount: 1 },
			})
			// one photo is still allowed
			await upload(owner)
			await prisma.dailyUsage.update({
				where: { userId_localDate: { userId: owner.userId, localDate: today } },
				data: { photoCount: 2 },
			})

			const response = await owner.agent.post(PHOTOS_URL).send(createUploadBody()).expect(429)

			const error = apiErrorResponseSchema.parse(response.body)
			expect(error.errorCode).toBe('DAILY_PHOTO_LIMIT_REACHED')
			expect(Object.keys(error.details).sort()).toEqual(['limit', 'resetsAt'])
			expect(error.details).toMatchObject({ limit: 2 })
			expect(await prisma.storedFile.count()).toBe(1)
		})
	})

	describe('rate limiting', () => {
		it(`answers 429 TOO_MANY_REQUESTS to upload number ${UPLOAD_THROTTLE_LIMIT + 1} within a minute`, async () => {
			await start()
			const owner = await registerUser('owner@kus.app')

			for (let attempt = 0; attempt < UPLOAD_THROTTLE_LIMIT; attempt++) {
				// an empty body is refused by validation, but the throttler counts it first
				await owner.agent.post(PHOTOS_URL).send({}).expect(422)
			}
			const response = await owner.agent.post(PHOTOS_URL).send({}).expect(429)

			expect(apiErrorResponseSchema.parse(response.body).errorCode).toBe('TOO_MANY_REQUESTS')
		})

		it('lets reads go far past the default limit of 100 a minute and stops at 600', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')

			for (let attempt = 0; attempt < READ_THROTTLE_LIMIT; attempt++) {
				const response = await owner.agent.get(`${PHOTOS_URL}/${UNKNOWN_ID}`)
				if (response.status !== 404) {
					throw new Error(
						`read ${attempt + 1} answered ${response.status}, the limit is ${READ_THROTTLE_LIMIT}`,
					)
				}
			}
			expect(READ_THROTTLE_LIMIT).toBeGreaterThan(DEFAULT_THROTTLE_LIMIT)
			const response = await owner.agent.get(`${PHOTOS_URL}/${UNKNOWN_ID}`).expect(429)

			expect(apiErrorResponseSchema.parse(response.body).errorCode).toBe('TOO_MANY_REQUESTS')
		}, 120_000)

		it('keeps the delete route on the default limit of 100 a minute', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')

			for (let attempt = 0; attempt < DEFAULT_THROTTLE_LIMIT; attempt++) {
				await owner.agent.delete(`${PHOTOS_URL}/${UNKNOWN_ID}`).expect(404)
			}
			await owner.agent.delete(`${PHOTOS_URL}/${UNKNOWN_ID}`).expect(429)
		}, 60_000)
	})

	describe('body limit', () => {
		const postRaw = (user: TestUser, body: Buffer, url = PHOTOS_URL) =>
			user.agent.post(url).set('Content-Type', 'application/json').send(body.toString())

		it('lets a body of exactly the photos limit through the parser (validation answers 422)', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')

			const response = await postRaw(owner, createJsonBodyOfSize(PHOTOS_BODY_LIMIT_BYTES))

			expect(response.status).toBe(422)
			expect(apiErrorResponseSchema.parse(response.body).errorCode).toBe('VALIDATION_ERROR')
		})

		it('answers 413 to a body one byte over the photos limit', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')

			const response = await postRaw(
				owner,
				createJsonBodyOfSize(PHOTOS_BODY_LIMIT_BYTES + OVER_BODY_LIMIT_BYTES),
			)

			expect(response.status).toBe(413)
			expect(response.body).toEqual({
				statusCode: 413,
				errorCode: 'PAYLOAD_TOO_LARGE',
				details: {},
			})
		})

		it('takes a real upload far above the 100 kb default', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const heavy = Buffer.concat([FULL_JPEG, Buffer.alloc(300_000)])
			const body = createUploadBody(heavy)
			expect(JSON.stringify(body).length).toBeGreaterThan(100 * 1024)

			await owner.agent.post(PHOTOS_URL).send(body).expect(201)
		})

		it('keeps the 100 kb limit on other routes (login)', async () => {
			await start()
			const body = JSON.stringify({ email: 'a@kus.app', password: 'A'.repeat(101 * 1024) })

			const response = await request(app.getHttpServer())
				.post('/api/v1/auth/login')
				.set('Content-Type', 'application/json')
				.send(body)

			expect(response.status).toBe(413)
			expect(response.body).toEqual({
				statusCode: 413,
				errorCode: 'PAYLOAD_TOO_LARGE',
				details: {},
			})
		})

		it('keeps the 100 kb limit for a GET-style path under /photos (only POST /photos is widened)', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')

			const response = await postRaw(
				owner,
				createJsonBodyOfSize(150 * 1024),
				`${PHOTOS_URL}/${UNKNOWN_ID}`,
			)

			expect(response.status).toBe(413)
		})

		it('also takes a real upload sent to /photos/ with a trailing slash', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const heavy = Buffer.concat([FULL_JPEG, Buffer.alloc(300_000)])
			// the slash is routed to the same handler, so it must get the same body limit
			await owner.agent.post(`${PHOTOS_URL}/`).send({}).expect(422)

			const response = await owner.agent.post(`${PHOTOS_URL}/`).send(createUploadBody(heavy))

			expect(response.status).toBe(201)
		})
	})
})
