import { Logger } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Env } from '../../config'
import type { AiClient } from './ai-client'
import { AI_PARSE_DEADLINE_MS } from './ai.constants'
import { AiUnavailableException } from './ai.exceptions'
import type { AiRepository } from './ai.repository'
import { AiService, type ParseFoodParams } from './ai.service'
import {
	createCompletion,
	createFakeAiClient,
	EMPTY_CONTEXT,
	EGGS_AND_BUCKWHEAT_ITEMS,
	type FakeToolCall,
	logFoodCall,
} from './ai.test-utils'
import type { ReadToolExecutor } from './read-tool-executor'

const READ_TOOL = 'find_food'

const config = { get: () => 'test/model' } as unknown as ConfigService<Env, true>

const readCall = (query = 'sportyfeel'): FakeToolCall => ({ name: READ_TOOL, args: { query } })
const memoryLogCall = (): FakeToolCall =>
	logFoodCall([{ ...EGGS_AND_BUCKWHEAT_ITEMS[0], source: 'MEMORY', memoryRef: 'm11' }])

describe('AiService.parseFood read-tool loop', () => {
	const fake = createFakeAiClient()
	const repository = {
		createRun: vi.fn<AiRepository['createRun']>(),
		addDailyCost: vi.fn<AiRepository['addDailyCost']>(),
	}
	const execute = vi.fn<ReadToolExecutor['execute']>()
	const reader: ReadToolExecutor = { execute }
	const service = new AiService(fake.client, repository as unknown as AiRepository, config)
	const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
	const logSpies = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		warn,
		vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
	]

	const params: ParseFoodParams = {
		userId: '01999a00-0000-7000-8000-000000000001',
		messageId: '01999a00-0000-7000-8000-0000000000a1',
		localDate: new Date('2026-10-07T00:00:00Z'),
		context: EMPTY_CONTEXT,
		text: 'батончик',
		findPreviousWeight: () => Promise.resolve(null),
		readTools: reader,
	}

	beforeEach(() => {
		fake.reset()
		vi.clearAllMocks()
		execute.mockResolvedValue({ text: 'm11 "Батончик"', refsPatch: { memoryRefs: ['m11'] } })
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('without a read keeps the old behaviour: one call, the executor is not touched', async () => {
		fake.respond(createCompletion([logFoodCall()]))

		await expect(service.parseFood(params)).resolves.toMatchObject({ kind: 'log' })

		expect(fake.bodies).toHaveLength(1)
		expect(execute).not.toHaveBeenCalled()
		expect(repository.createRun).toHaveBeenCalledTimes(1)
	})

	it('answers one read and accepts a ref the read handed out, one run per step', async () => {
		fake.respond(
			createCompletion([readCall()], { costUsd: 0.004 }),
			createCompletion([memoryLogCall()], { costUsd: 0.001 }),
		)

		await expect(service.parseFood(params)).resolves.toMatchObject({ kind: 'log' })

		expect(execute).toHaveBeenCalledWith(
			{ name: READ_TOOL, arguments: JSON.stringify({ query: 'sportyfeel' }) },
			expect.objectContaining({ userId: params.userId, localDate: params.localDate }),
		)
		const second = JSON.stringify(fake.bodies[1])
		expect(second).toContain('"role":"assistant"')
		expect(second).toContain('"tool_call_id":"call_0"')
		expect(second).toContain('m11 \\"Батончик\\"')
		const runs = repository.createRun.mock.calls.map(([run]) => run)
		expect(runs.map((run) => [run.purpose, run.status, run.errorCode])).toEqual([
			['PARSE_FOOD', 'SUCCEEDED', null],
			['PARSE_FOOD', 'SUCCEEDED', null],
		])
		expect(runs[0]?.toolCalls[0]).toMatchObject({
			name: READ_TOOL,
			status: 'SUCCEEDED',
			result: { text: 'm11 "Батончик"' },
		})
		const costs = repository.addDailyCost.mock.calls.map(([usage]) => usage.costUsd)
		expect(costs).toEqual([0.004, 0.001])
	})

	it('keeps the digest of a read next to its text in the stored call, and the digest never reaches the model', async () => {
		execute.mockResolvedValue({
			text: 'm11 "Батончик"',
			refsPatch: { memoryRefs: ['m11'] },
			digest: 'read food "sportyfeel": 1 found',
		})
		fake.respond(createCompletion([readCall()]), createCompletion([memoryLogCall()]))

		await service.parseFood(params)

		const [firstRun] = repository.createRun.mock.calls.map(([run]) => run)
		expect(firstRun?.toolCalls[0]?.result).toEqual({
			text: 'm11 "Батончик"',
			digest: 'read food "sportyfeel": 1 found',
		})
		expect(JSON.stringify(fake.bodies[1])).not.toContain('read food')
	})

	it('rejects a ref the reads did not hand out', async () => {
		execute.mockResolvedValue({ text: 'No match' })
		fake.respond(
			createCompletion([readCall()]),
			createCompletion([memoryLogCall()]),
			createCompletion([logFoodCall()]),
		)

		await expect(service.parseFood(params)).resolves.toMatchObject({ kind: 'log' })

		expect(JSON.stringify(fake.bodies[2])).toContain('m11')
		expect(fake.bodies).toHaveLength(3)
	})

	it('takes two read steps, then closes reading: a third read is «answer now»', async () => {
		fake.respond(
			createCompletion([readCall('a')]),
			createCompletion([readCall('b')]),
			createCompletion([readCall('c')]),
			createCompletion([memoryLogCall()]),
		)

		await expect(service.parseFood(params)).resolves.toMatchObject({ kind: 'log' })

		expect(execute).toHaveBeenCalledTimes(2)
		expect(fake.bodies).toHaveLength(4)
		expect(JSON.stringify(fake.bodies[3])).toContain('reading is closed')
		expect(repository.createRun.mock.calls.map(([run]) => run.errorCode)).toEqual([
			null,
			null,
			'INVALID_TOOL_CALLS',
			null,
		])
	})

	it('gives up with AI_UNAVAILABLE when the model keeps reading after the retry', async () => {
		fake.respond(
			createCompletion([readCall('a')]),
			createCompletion([readCall('b')]),
			createCompletion([readCall('c')]),
			createCompletion([readCall('d')]),
		)

		await expect(service.parseFood(params)).rejects.toBeInstanceOf(AiUnavailableException)
		expect(fake.bodies).toHaveLength(4)
		expect(execute).toHaveBeenCalledTimes(2)
	})

	it('does not execute a write that came with a read', async () => {
		fake.respond(createCompletion([readCall(), logFoodCall()]), createCompletion([memoryLogCall()]))

		const decision = await service.parseFood(params)

		expect(decision.kind).toBe('log')
		expect(execute).toHaveBeenCalledTimes(1)
		const second = JSON.stringify(fake.bodies[1])
		expect(second).toContain('not executed: call it again after reading')
		const [firstRun] = repository.createRun.mock.calls.map(([run]) => run)
		expect(firstRun?.toolCalls.map((call) => call.status)).toEqual(['SUCCEEDED', 'REJECTED'])
	})

	it('runs at most four reads at once and leaves the rest unexecuted', async () => {
		fake.respond(
			createCompletion([1, 2, 3, 4, 5].map((n) => readCall(`q${n}`))),
			createCompletion([memoryLogCall()]),
		)

		await service.parseFood(params)

		expect(execute).toHaveBeenCalledTimes(4)
		expect(JSON.stringify(fake.bodies[1])).toContain('at most 4 reads at a time')
	})

	it('stops reading when too little of the shared deadline is left', async () => {
		let now = 1_000_000
		const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now)
		const slowClient: AiClient = {
			post: (path, options) => {
				now += AI_PARSE_DEADLINE_MS - 5_000
				return fake.client.post(path, options)
			},
		}
		const slowService = new AiService(slowClient, repository as unknown as AiRepository, config)
		fake.respond(createCompletion([readCall()]), createCompletion([logFoodCall()]))

		try {
			await expect(slowService.parseFood(params)).resolves.toMatchObject({ kind: 'log' })
		} finally {
			nowSpy.mockRestore()
		}

		expect(execute).not.toHaveBeenCalled()
		expect(JSON.stringify(fake.bodies[1])).toContain('reading is closed')
	})

	it('fails the turn when the executor throws, after recording the step', async () => {
		execute.mockRejectedValue(new TypeError('db down for food text'))
		fake.respond(createCompletion([readCall()]), createCompletion([logFoodCall()]))

		await expect(service.parseFood(params)).rejects.toBeInstanceOf(AiUnavailableException)

		expect(fake.bodies).toHaveLength(1)
		expect(repository.createRun).toHaveBeenCalledWith(
			expect.objectContaining({
				status: 'FAILED',
				errorCode: 'READ_TOOL_FAILED',
				toolCalls: [expect.objectContaining({ name: READ_TOOL, status: 'FAILED' })],
			}),
		)
		const logged = JSON.stringify(warn.mock.calls)
		expect(logged).toContain('TypeError')
		expect(logged).not.toContain('food text')
	})

	it('puts a cache point on the user message only when reading is possible, history included', async () => {
		fake.respond(
			createCompletion([logFoodCall()]),
			createCompletion([logFoodCall()]),
			createCompletion([logFoodCall()]),
		)
		const withHistory = {
			...params,
			context: {
				...params.context,
				history: [
					{ role: 'user' as const, content: 'чай' },
					{ role: 'assistant' as const, content: 'Записав чай' },
				],
			},
		}

		await service.parseFood(params)
		await service.parseFood({ ...params, readTools: undefined })
		await service.parseFood(withHistory)

		const cachePoints = (body: unknown): number =>
			(JSON.stringify(body).match(/"cache_control"/g) ?? []).length
		expect(cachePoints(fake.bodies[0])).toBe(2)
		expect(cachePoints(fake.bodies[1])).toBe(1)
		// prompt, the last message of the day, the user message: within Anthropic's four
		expect(cachePoints(fake.bodies[2])).toBe(3)
	})
})
