import { Logger } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { APIConnectionError, APIError, APIUserAbortError } from 'openai'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Env } from '../../config'
import { AI_PARSE_DEADLINE_MS } from './ai.constants'
import { AiUnavailableException, MessageTooLongException } from './ai.exceptions'
import type { AiRepository } from './ai.repository'
import { AiService, type ParseFoodParams } from './ai.service'
import {
	createCompletion,
	createFakeAiClient,
	EMPTY_CONTEXT,
	INVALID_ITEM,
	logFoodCall,
	TRUNCATED_COMPLETION,
} from './ai.test-utils'

const config = { get: () => 'test/model' } as unknown as ConfigService<Env, true>

const IMAGE_BASE64 = Buffer.alloc(4000, 0x5a).toString('base64')
const VISION_MODEL = 'test/vision'
const visionConfig = {
	get: (key: string) => (key === 'AI_MODEL_VISION' ? VISION_MODEL : 'test/model'),
} as unknown as ConfigService<Env, true>

const params: ParseFoodParams = {
	userId: '01999a00-0000-7000-8000-000000000001',
	messageId: '01999a00-0000-7000-8000-0000000000a1',
	localDate: new Date('2026-10-07T00:00:00Z'),
	context: EMPTY_CONTEXT,
	text: '3 варені яйця і 100 г гречки',
}

describe('AiService.parseFood', () => {
	const fake = createFakeAiClient()
	const repository = {
		createRun: vi.fn<AiRepository['createRun']>(),
		addDailyCost: vi.fn<AiRepository['addDailyCost']>(),
	}
	const service = new AiService(fake.client, repository as unknown as AiRepository, config)
	const logSpies = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
	]

	beforeEach(() => {
		fake.reset()
		vi.clearAllMocks()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('returns the decision and records one successful run with its cost', async () => {
		fake.respond(createCompletion([logFoodCall()], { costUsd: 0.003 }))

		const decision = await service.parseFood(params)

		expect(decision.kind).toBe('log')
		expect(repository.createRun).toHaveBeenCalledTimes(1)
		expect(repository.createRun).toHaveBeenCalledWith(
			expect.objectContaining({
				status: 'SUCCEEDED',
				purpose: 'PARSE_FOOD',
				inputTokens: 3000,
				outputTokens: 300,
				costUsd: 0.003,
				errorCode: null,
			}),
		)
		expect(repository.addDailyCost).toHaveBeenCalledWith(
			expect.objectContaining({ costUsd: 0.003 }),
		)
	})

	it('sends deterministic, private requests with tools and a cacheable prompt', async () => {
		fake.respond(createCompletion([logFoodCall()]))
		await service.parseFood(params)

		expect(fake.bodies[0]).toMatchObject({
			model: 'test/model',
			temperature: 0,
			max_tokens: 8000,
			tool_choice: 'auto',
			provider: { data_collection: 'deny' },
		})
		expect(JSON.stringify(fake.bodies[0])).toContain(
			'"role":"system","content":[{"type":"text","text":"You are Kusik',
		)
		expect(JSON.stringify(fake.bodies[0])).toContain('"cache_control":{"type":"ephemeral"}')
	})

	it('retries once with the validation errors and succeeds', async () => {
		fake.respond(createCompletion([logFoodCall([INVALID_ITEM])]), createCompletion([logFoodCall()]))

		const decision = await service.parseFood(params)

		expect(decision.kind).toBe('log')
		expect(repository.createRun.mock.calls.map(([run]) => [run.status, run.errorCode])).toEqual([
			['FAILED', 'INVALID_TOOL_CALLS'],
			['SUCCEEDED', null],
		])
		expect(repository.createRun.mock.calls[0]?.[0].toolCalls[0]?.status).toBe('REJECTED')
		const retryBody = JSON.stringify(fake.bodies[1])
		expect(retryBody).toContain('"role":"tool"')
		expect(retryBody).toContain('kcal does not match')
	})

	it('gives up with AI_UNAVAILABLE after a second invalid answer', async () => {
		fake.respond(
			createCompletion([logFoodCall([INVALID_ITEM])]),
			createCompletion([logFoodCall([INVALID_ITEM])]),
		)

		await expect(service.parseFood(params)).rejects.toBeInstanceOf(AiUnavailableException)
		expect(fake.bodies).toHaveLength(2)
		expect(repository.createRun).toHaveBeenCalledTimes(2)
	})

	it('treats a text answer without tool calls as invalid', async () => {
		fake.respond(createCompletion([], { content: 'Записав!' }), createCompletion([logFoodCall()]))

		await expect(service.parseFood(params)).resolves.toMatchObject({ kind: 'log' })
		expect(JSON.stringify(fake.bodies[1])).toContain('always answer with a tool call')
	})

	it('fails a cut-off answer with OUTPUT_TRUNCATED and does not retry it', async () => {
		fake.respond(TRUNCATED_COMPLETION, createCompletion([logFoodCall()]))

		await expect(service.parseFood(params)).rejects.toBeInstanceOf(MessageTooLongException)
		expect(fake.bodies).toHaveLength(1)
		expect(repository.createRun).toHaveBeenCalledTimes(1)
		expect(repository.createRun).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'FAILED', errorCode: 'OUTPUT_TRUNCATED' }),
		)
		expect(JSON.stringify(logSpies[1]?.mock.calls)).toContain('error=OUTPUT_TRUNCATED')
	})

	it('records a network failure and throws AI_UNAVAILABLE', async () => {
		fake.respond(new APIConnectionError({ message: 'socket hang up' }))

		await expect(service.parseFood(params)).rejects.toBeInstanceOf(AiUnavailableException)
		expect(repository.createRun).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'FAILED', errorCode: 'NETWORK', costUsd: 0 }),
		)
	})

	it('gives up at the whole-parse deadline, so the turn answers before the Vercel proxy cuts it', async () => {
		const deadline = new AbortController()
		const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal)
		// the model never answers; only the deadline ends the call, as the real SDK does
		vi.mocked(fake.client.post).mockImplementationOnce(
			(_path, { signal }) =>
				new Promise((_resolve, reject) => {
					signal.addEventListener('abort', () => {
						reject(new APIUserAbortError())
					})
				}),
		)
		try {
			const parsing = service.parseFood(params)
			deadline.abort()

			await expect(parsing).rejects.toBeInstanceOf(AiUnavailableException)
			expect(timeoutSpy).toHaveBeenCalledWith(AI_PARSE_DEADLINE_MS)
			expect(repository.createRun).toHaveBeenCalledWith(
				expect.objectContaining({ status: 'FAILED', errorCode: 'DEADLINE' }),
			)
		} finally {
			timeoutSpy.mockRestore()
		}
	})

	it('rejects a response that is not a chat completion', async () => {
		fake.respond({ error: { message: 'No endpoints found matching your data policy' } })

		await expect(service.parseFood(params)).rejects.toBeInstanceOf(AiUnavailableException)
		expect(repository.createRun).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'FAILED', errorCode: 'BAD_RESPONSE' }),
		)
	})

	it('never logs message text or food', async () => {
		fake.respond(createCompletion([logFoodCall()]))
		await service.parseFood(params)

		const logged = JSON.stringify(logSpies.map((spy) => spy.mock.calls))
		expect(logged).toContain('cost=')
		expect(logged).not.toContain('яйц')
		expect(logged).not.toContain('Гречка')
	})

	describe('with a photo', () => {
		const visionService = new AiService(
			fake.client,
			repository as unknown as AiRepository,
			visionConfig,
		)
		const photoParams: ParseFoodParams = {
			...params,
			image: { mimeType: 'image/jpeg', base64: IMAGE_BASE64 },
		}
		const getLogged = (): string => JSON.stringify(logSpies.map((spy) => spy.mock.calls))

		it('uses the vision model and puts the image into the request only', async () => {
			fake.respond(createCompletion([logFoodCall()]))

			await visionService.parseFood(photoParams)

			expect(fake.bodies[0]).toMatchObject({ model: VISION_MODEL })
			expect(JSON.stringify(fake.bodies[0])).toContain(`data:image/jpeg;base64,${IMAGE_BASE64}`)
			expect(getLogged()).toContain('photo=1')
		})

		it('never logs or records the image, on success, retry or failure', async () => {
			fake.respond(
				createCompletion([logFoodCall([INVALID_ITEM])]),
				createCompletion([logFoodCall()]),
			)
			await visionService.parseFood(photoParams)
			fake.respond(new APIConnectionError({ message: `socket hang up ${IMAGE_BASE64}` }))
			await expect(visionService.parseFood(photoParams)).rejects.toBeInstanceOf(
				AiUnavailableException,
			)

			const stored = JSON.stringify(repository.createRun.mock.calls)
			for (const text of [getLogged(), stored]) {
				expect(text).not.toContain('base64,')
				expect(text).not.toContain(IMAGE_BASE64.slice(0, 60))
			}
		})

		it('logs an SDK error that quotes the data URL as its code only', async () => {
			const dataUrl = `data:image/jpeg;base64,${IMAGE_BASE64}`
			fake.respond(new APIError(400, { message: dataUrl }, `400 ${dataUrl}`, new Headers()))

			await expect(visionService.parseFood(photoParams)).rejects.toBeInstanceOf(
				AiUnavailableException,
			)

			const logged = getLogged()
			expect(logged).toContain('error=HTTP_400')
			expect(logged).not.toContain('base64,')
			expect(logged).not.toContain(IMAGE_BASE64.slice(0, 60))
			expect(JSON.stringify(repository.createRun.mock.calls)).not.toContain(
				IMAGE_BASE64.slice(0, 60),
			)
			expect(repository.createRun).toHaveBeenCalledWith(
				expect.objectContaining({ model: VISION_MODEL, errorCode: 'HTTP_400' }),
			)
		})

		it('lets photo_unusable through only with a photo', async () => {
			const unusable = {
				name: 'photo_unusable',
				args: { reason: 'no_food', reply: 'Не бачу їжі, сфотографуй ще раз.' },
			}
			fake.respond(createCompletion([unusable]))
			await expect(visionService.parseFood(photoParams)).resolves.toMatchObject({
				kind: 'photo_unusable',
			})

			fake.respond(createCompletion([unusable]), createCompletion([unusable]))
			await expect(service.parseFood(params)).rejects.toBeInstanceOf(AiUnavailableException)
		})
	})
})
