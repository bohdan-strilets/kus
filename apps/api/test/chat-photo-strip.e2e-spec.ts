import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { apiErrorResponseSchema } from '@kus/shared'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createCompletion, createFakeAiClient, logFoodCall } from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import {
	getSentImageBytes,
	MESSAGES_URL,
	registerUser,
	type TestUser,
} from './chat-photo-test-utils'
import { createDbTestApp } from './create-db-test-app'
import { createJpeg, JPEG_SENTINEL, toBase64 } from './fixtures/jpeg'
import {
	createJpegWithOpenScan,
	createProgressiveJpeg,
	SCAN_DATA_A,
	SCAN_DATA_B,
	SCAN_DATA_C,
} from './fixtures/jpeg-scans'

const EOI = Buffer.from([0xff, 0xd9])
const TRAILING_SECRET = 'TRAILING-SECRET-AFTER-EOI'

const fake = createFakeAiClient()

describe('the JPEG metadata stripper behind POST /messages (e2e, fake model)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	let owner: TestUser
	const logSpies = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
	]

	beforeEach(async () => {
		fake.reset()
		;({ app, prisma } = await createDbTestApp({ aiClient: fake.client }))
		owner = await registerUser(app, 'owner@kus.app')
	})

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	const sendPhoto = (jpeg: Buffer) =>
		owner.agent.post(MESSAGES_URL).send({
			clientMessageId: randomUUID(),
			photo: { mimeType: 'image/jpeg', data: toBase64(jpeg) },
		})

	it('accepts a progressive JPEG with several scans and keeps every scan, cutting only the comment between them', async () => {
		const { jpeg, withoutComment } = createProgressiveJpeg()
		fake.respond(createCompletion([logFoodCall()]))

		await sendPhoto(jpeg).expect(201)

		const sent = getSentImageBytes(fake.bodies[0])
		expect(sent.equals(withoutComment)).toBe(true)
		expect(sent.includes(JPEG_SENTINEL)).toBe(false)
		for (const scan of [SCAN_DATA_A, SCAN_DATA_B, SCAN_DATA_C])
			expect(sent.includes(scan)).toBe(true)
		expect((await prisma.messageAttachment.findFirstOrThrow()).sizeBytes).toBe(
			withoutComment.length,
		)
	})

	it('answers 422 photo=PHOTO_INVALID for a scan that runs to the end of the file without a marker', async () => {
		const response = await sendPhoto(createJpegWithOpenScan()).expect(422)

		const body = apiErrorResponseSchema.parse(response.body)
		expect(body.errorCode).toBe('VALIDATION_ERROR')
		expect(body.details).toEqual({ fields: { photo: 'PHOTO_INVALID' } })
		expect(await prisma.message.count()).toBe(0)
		expect(fake.bodies).toHaveLength(0)
	})

	it('does not pass what follows the EOI marker to the model', async () => {
		const clean = createJpeg()
		const withTail = Buffer.concat([
			clean,
			Buffer.from([0xff, 0xe1, 0x00, 0x20]),
			Buffer.from(`Exif\0\0${JPEG_SENTINEL}${TRAILING_SECRET}`, 'latin1'),
		])
		fake.respond(createCompletion([logFoodCall()]))

		await sendPhoto(withTail).expect(201)

		const sent = getSentImageBytes(fake.bodies[0])
		expect(sent.equals(clean)).toBe(true)
		expect(sent.subarray(-EOI.length).equals(EOI)).toBe(true)
		expect(sent.includes(TRAILING_SECRET)).toBe(false)
		expect(sent.includes(JPEG_SENTINEL)).toBe(false)
		expect((await prisma.messageAttachment.findFirstOrThrow()).sizeBytes).toBe(clean.length)
	})

	it('also cuts a tail after the EOI of a progressive JPEG', async () => {
		const { jpeg, withoutComment } = createProgressiveJpeg()
		fake.respond(createCompletion([logFoodCall()]))

		await sendPhoto(Buffer.concat([jpeg, Buffer.from(TRAILING_SECRET)])).expect(201)

		expect(getSentImageBytes(fake.bodies[0]).equals(withoutComment)).toBe(true)
	})
})
