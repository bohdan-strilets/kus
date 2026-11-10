import { Logger } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { APIError } from 'openai'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Env } from '../../config'
import { AI_PARSE_DEADLINE_MS, AI_RATE_LIMIT_MAX_WAIT_MS } from './ai.constants'
import { AiRateLimitedException, AiUnavailableException } from './ai.exceptions'
import type { AiRepository } from './ai.repository'
import { AiService, type ParseFoodParams } from './ai.service'
import {
	createCompletion,
	createFakeAiClient,
	EMPTY_CONTEXT,
	INVALID_ITEM,
	logFoodCall,
} from './ai.test-utils'

const config = { get: () => 'test/model' } as unknown as ConfigService<Env, true>

const params: ParseFoodParams = {
	userId: '01999a00-0000-7000-8000-000000000001',
	messageId: '01999a00-0000-7000-8000-0000000000a1',
	localDate: new Date('2026-10-07T00:00:00Z'),
	context: EMPTY_CONTEXT,
	text: 'секретний борщ з пампушками',
	findPreviousWeight: () => Promise.resolve(null),
}

const SECOND = 1000

/** What OpenRouter answers when the upstream provider is rate limited. */
const rateLimit = (retryAfter?: string): APIError =>
	new APIError(
		429,
		{
			message: 'Provider returned error',
			code: 429,
			metadata: { provider_name: 'Anthropic', raw: 'rate limited, request body: секретний борщ' },
		},
		'429 Provider returned error',
		new Headers(retryAfter === undefined ? {} : { 'retry-after': retryAfter }),
	)

const rateLimitWithoutBody = (): APIError =>
	new APIError(429, undefined, '429 status code (no body)', new Headers())

describe('AiService.parseFood: provider 429', () => {
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
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('retries a 429 after Retry-After and returns the answer of the second call', async () => {
		fake.respond(rateLimit('3'), createCompletion([logFoodCall()]))

		const parsing = service.parseFood(params)
		await vi.advanceTimersByTimeAsync(3 * SECOND - 1)
		expect(fake.bodies).toHaveLength(1)
		await vi.advanceTimersByTimeAsync(1)

		await expect(parsing).resolves.toMatchObject({ kind: 'log' })
		expect(fake.bodies).toHaveLength(2)
		expect(repository.createRun).toHaveBeenCalledTimes(1)
		expect(repository.createRun).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'SUCCEEDED', errorCode: null }),
		)
	})

	it('fails with AI_RATE_LIMITED after two retries, waiting 2 s and then 4 s without Retry-After', async () => {
		fake.respond(rateLimit(), rateLimit(), rateLimit(), createCompletion([logFoodCall()]))

		const failed = expect(service.parseFood(params)).rejects.toBeInstanceOf(AiRateLimitedException)
		await vi.advanceTimersByTimeAsync(2 * SECOND - 1)
		expect(fake.bodies).toHaveLength(1)
		await vi.advanceTimersByTimeAsync(1)
		expect(fake.bodies).toHaveLength(2)
		await vi.advanceTimersByTimeAsync(4 * SECOND)

		await failed
		expect(fake.bodies).toHaveLength(3)
		expect(repository.createRun).toHaveBeenCalledTimes(1)
		expect(repository.createRun).toHaveBeenCalledWith(
			expect.objectContaining({
				status: 'FAILED',
				errorCode: 'HTTP_429',
				errorDetail: 'provider=Anthropic; retryAfter=none; attempt=3',
			}),
		)
	})

	it('cuts a long Retry-After to the cap', async () => {
		fake.respond(rateLimit('60'), createCompletion([logFoodCall()]))

		const parsing = service.parseFood(params)
		await vi.advanceTimersByTimeAsync(AI_RATE_LIMIT_MAX_WAIT_MS)

		await expect(parsing).resolves.toMatchObject({ kind: 'log' })
	})

	it('does not retry when the wait would leave too little of the deadline', async () => {
		// the first call itself eats 90 of the 95 s
		vi.mocked(fake.client.post).mockImplementationOnce(() => {
			vi.advanceTimersByTime(90 * SECOND)
			return Promise.reject(rateLimit('2'))
		})

		await expect(service.parseFood(params)).rejects.toBeInstanceOf(AiRateLimitedException)
		expect(fake.client.post).toHaveBeenCalledTimes(1)
		expect(repository.createRun).toHaveBeenCalledWith(
			expect.objectContaining({
				errorCode: 'HTTP_429',
				errorDetail: expect.stringContaining('attempt=1') as string,
			}),
		)
	})

	it('does not retry once the deadline signal has fired', async () => {
		const deadline = new AbortController()
		deadline.abort()
		const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal)
		fake.respond(rateLimit('1'), createCompletion([logFoodCall()]))
		try {
			await expect(service.parseFood(params)).rejects.toBeInstanceOf(AiUnavailableException)
			expect(timeoutSpy).toHaveBeenCalledWith(AI_PARSE_DEADLINE_MS)
			expect(fake.bodies).toHaveLength(1)
		} finally {
			timeoutSpy.mockRestore()
		}
	})

	it('logs only metadata of a 429: provider, Retry-After, attempt, ids — never the body or the text', async () => {
		fake.respond(rateLimit('2'), createCompletion([logFoodCall()]))
		const parsing = service.parseFood(params)
		await vi.advanceTimersByTimeAsync(2 * SECOND)
		await parsing

		const logged = JSON.stringify(logSpies.map((spy) => spy.mock.calls))
		expect(logged).toContain('provider=Anthropic')
		expect(logged).toContain('retryAfterMs=2000')
		expect(logged).toContain('attempt=1')
		expect(logged).toContain(params.userId)
		expect(logged).toContain(params.messageId)
		expect(logged).not.toContain('борщ')
		expect(logged).not.toContain('rate limited, request body')
	})

	it('records the provider as unknown when the error body has none', async () => {
		fake.respond(rateLimitWithoutBody(), rateLimitWithoutBody(), rateLimitWithoutBody())
		const failed = expect(service.parseFood(params)).rejects.toBeInstanceOf(AiRateLimitedException)
		await vi.advanceTimersByTimeAsync(6 * SECOND)

		await failed
		expect(repository.createRun).toHaveBeenCalledWith(
			expect.objectContaining({ errorDetail: 'provider=unknown; retryAfter=none; attempt=3' }),
		)
	})
})

describe('AiService.parseFood: errorDetail of an invalid answer', () => {
	const fake = createFakeAiClient()
	const repository = {
		createRun: vi.fn<AiRepository['createRun']>(),
		addDailyCost: vi.fn<AiRepository['addDailyCost']>(),
	}
	const service = new AiService(fake.client, repository as unknown as AiRepository, config)

	beforeEach(() => {
		fake.reset()
		vi.clearAllMocks()
	})

	it('records the validation errors of each rejected answer, without the user text', async () => {
		fake.respond(
			createCompletion([logFoodCall([INVALID_ITEM])]),
			createCompletion([logFoodCall([INVALID_ITEM])]),
		)

		await expect(service.parseFood(params)).rejects.toBeInstanceOf(AiUnavailableException)

		const calls = repository.createRun.mock.calls.map(([data]) => data)
		expect(calls).toHaveLength(2)
		for (const data of calls) {
			expect(data.errorCode).toBe('INVALID_TOOL_CALLS')
			expect(data.errorDetail).toContain('log_food')
			expect(data.errorDetail).not.toContain('Суп')
			expect(data.errorDetail?.length).toBeLessThanOrEqual(500)
		}
	})

	it('leaves errorDetail empty for a successful run', async () => {
		fake.respond(createCompletion([logFoodCall()]))

		await service.parseFood(params)

		expect(repository.createRun).toHaveBeenCalledWith(
			expect.objectContaining({ errorDetail: null }),
		)
	})
})
