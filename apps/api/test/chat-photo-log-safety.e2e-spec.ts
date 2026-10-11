import { randomUUID } from 'node:crypto'

import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	authSessionResponseSchema,
	createDataResponseSchema,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { createFakeAiClient } from '../src/modules/ai/ai.test-utils'
import { ChatTurnService } from '../src/modules/chat/chat-turn.service'
import { createCapturingLogger, createDbTestApp } from './create-db-test-app'
import { createJpeg, JPEG_SENTINEL, toBase64 } from './fixtures/jpeg'

const MESSAGES_URL = '/api/v1/messages'
const BASE64_RUN_MIN_LENGTH = 200
const BASE64_RUN = new RegExp(`[A-Za-z0-9+/=]{${BASE64_RUN_MIN_LENGTH},}`)
const OVERSIZED_BODY_CHARS = 2_600_000
const FIELD_CODE = /^[A-Z][A-Z0-9_]*$/

const fieldsSchema = z.object({ fields: z.record(z.string(), z.string()) })

const fake = createFakeAiClient()
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
		// the last chars may be shared with padding bits
		return encoded.slice(firstWholeChar, -3)
	})

/** What a leaked photo would leave behind: the plain marker, its base64, a data URL, a base64 run. */
const expectNoPhotoIn = (text: string, jpeg: Buffer): void => {
	const wholeBase64 = toBase64(jpeg)
	expect(text).not.toContain(JPEG_SENTINEL)
	for (const fragment of getSentinelBase64Fragments()) expect(text).not.toContain(fragment)
	expect(text).not.toContain(wholeBase64.slice(10, 50))
	expect(text).not.toContain('base64,')
	expect(text).not.toMatch(BASE64_RUN)
}

describe('a photo never reaches the logs or the error bodies (e2e)', () => {
	let app: NestExpressApplication
	let agent: TestAgent
	const jpeg = createJpeg({ hasSentinel: true })
	const photo = { mimeType: 'image/jpeg', data: toBase64(jpeg) }
	const dataUrl = `data:image/jpeg;base64,${photo.data}`

	beforeAll(async () => {
		;({ app } = await createDbTestApp({ aiClient: fake.client, logger }))
		agent = request.agent(app.getHttpServer())
		await agent
			.post('/api/v1/auth/register')
			.send({ email: 'owner@kus.app', password: 'correct-horse-battery', name: 'T', consent: true })
			.expect(201)
			.then((response) => createDataResponseSchema(authSessionResponseSchema).parse(response.body))
	})

	beforeEach(() => {
		fake.reset()
		logger.lines.length = 0
	})

	afterAll(async () => {
		await app.close()
	})

	const post = (body: Record<string, unknown>) =>
		agent.post(MESSAGES_URL).send({ clientMessageId: randomUUID(), ...body })

	const expectClean = (responseText: string, bytes: Buffer = jpeg): void => {
		expectNoPhotoIn(responseText, bytes)
		expectNoPhotoIn(logger.lines.join('\n'), bytes)
	}

	/** details.fields of a 422, which must hold nothing but codes. */
	const getFields = (response: { body: unknown }): Record<string, string> => {
		const { fields } = fieldsSchema.parse(apiErrorResponseSchema.parse(response.body).details)
		for (const code of Object.values(fields)) expect(code).toMatch(FIELD_CODE)
		return fields
	}

	it('422 for a missing clientMessageId', async () => {
		const response = await agent.post(MESSAGES_URL).send({ photo }).expect(422)

		expect(getFields(response)).toMatchObject({ clientMessageId: 'REQUIRED' })
		expectClean(response.text)
	})

	it('422 for data that is not base64', async () => {
		const response = await post({
			photo: { ...photo, data: `${photo.data}!!! not base64` },
		}).expect(422)

		expect(getFields(response)).toEqual({ 'photo.data': 'INVALID_FORMAT' })
		expectClean(response.text)
	})

	it('422 for bytes that are not the declared image type', async () => {
		const forged = Buffer.concat([
			Buffer.from('GIF89a'),
			Buffer.from(JPEG_SENTINEL),
			Buffer.alloc(80),
		])

		const response = await post({
			photo: { mimeType: 'image/jpeg', data: toBase64(forged) },
		}).expect(422)

		expect(getFields(response)).toEqual({ photo: 'UNSUPPORTED_IMAGE' })
		expectClean(response.text, forged)
	})

	it('422 for a side beyond the limit', async () => {
		const huge = createJpeg({ width: 3000, height: 480, hasSentinel: true })

		const response = await post({ photo: { mimeType: 'image/jpeg', data: toBase64(huge) } }).expect(
			422,
		)

		expect(getFields(response)).toEqual({ photo: 'PHOTO_INVALID' })
		expectClean(response.text, huge)
	})

	it('422 for more bytes than the photo limit', async () => {
		const heavy = Buffer.concat([createJpeg({ hasSentinel: true }), Buffer.alloc(1_450_000)])

		const response = await post({ photo: { mimeType: 'image/jpeg', data: toBase64(heavy) } })

		expect(response.status).toBe(422)
		expect(Object.keys(getFields(response))).toEqual(['photo.data'])
		expectClean(response.text, jpeg)
	})

	it('413 for a body above the message limit', async () => {
		const response = await post({ photo: { ...photo, data: 'A'.repeat(OVERSIZED_BODY_CHARS) } })

		expect(response.status).toBe(413)
		expect(response.body).toEqual({ statusCode: 413, errorCode: 'PAYLOAD_TOO_LARGE', details: {} })
		expectClean(response.text)
	})

	it('400 for JSON cut in the middle of the photo', async () => {
		const cut = `{"clientMessageId":"${randomUUID()}","photo":{"mimeType":"image/jpeg","data":"${photo.data}`

		const response = await agent
			.post(MESSAGES_URL)
			.set('Content-Type', 'application/json')
			.send(cut)
			.expect(400)

		expect(response.body).toEqual({ statusCode: 400, errorCode: 'BAD_REQUEST', details: {} })
		expectClean(response.text)
	})

	it('503 when the model client fails with the data URL in its message', async () => {
		fake.respond(new Error(`400 Invalid image: ${dataUrl}`))

		const response = await post({ photo }).expect(503)

		expect(apiErrorResponseSchema.parse(response.body).errorCode).toBe('AI_UNAVAILABLE')
		expectClean(response.text)
	})

	it('500 when something after the model quotes the data URL in a TypeError', async () => {
		// AiService turns every client failure into 503, so the unknown-5xx path needs a later step
		const spy = vi
			.spyOn(app.get(ChatTurnService), 'saveDecision')
			.mockRejectedValue(new TypeError(`Cannot read the image ${dataUrl}`))
		fake.respond({
			model: 'test/model',
			choices: [
				{
					message: {
						content: null,
						tool_calls: [
							{
								id: 'call_0',
								type: 'function',
								function: {
									name: 'photo_unusable',
									arguments: JSON.stringify({ reason: 'no_food', reply: 'Не бачу їжі' }),
								},
							},
						],
					},
					finish_reason: 'tool_calls',
				},
			],
			usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0 },
		})

		const response = await post({ photo }).expect(500)
		spy.mockRestore()

		expect(response.body).toEqual({ statusCode: 500, errorCode: 'INTERNAL_ERROR', details: {} })
		expect(logger.lines.some((line) => line.startsWith('error: Request failed'))).toBe(true)
		expectClean(response.text)
	})
})
