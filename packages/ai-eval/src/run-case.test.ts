import type { AiCompletion, AiRequestMessage } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { ONE_BAR_FOODS } from './cases/read-tools.cases.js'
import type { EvalCase } from './cases/index.js'
import { isCaseMemoryCorrect } from './memory-metrics.js'
import type { CompletionResponse } from './openrouter.js'
import { type RequestFn, runCase } from './run-case.js'

const OPTIONS = { apiKey: 'key', model: 'test/model', reasoning: 'low' as const }
const COST_USD = 0.01

const completion = (calls: { id: string; name: string; args: object }[]): CompletionResponse => {
	const body: AiCompletion = {
		choices: [
			{
				message: {
					content: null,
					tool_calls: calls.map(({ id, name, args }) => ({
						id,
						function: { name, arguments: JSON.stringify(args) },
					})),
				},
				finish_reason: 'tool_calls',
			},
		],
		usage: { prompt_tokens: 100, completion_tokens: 10, cost: COST_USD },
	}
	return { completion: body, latencyMs: 5 }
}

const findFood = (query: string, id = 'c1') =>
	({ id, name: 'find_food', args: { query, scope: 'all' } }) as const

const barItem = (overrides: object = {}) => ({
	name: 'Батончик SportyFeel',
	grams: 45,
	kcal: 157,
	protein: 15,
	fat: 5,
	carbs: 13,
	category: 'protein_bar',
	source: 'MEMORY',
	confidence: 0.9,
	fiber: null,
	quantity: null,
	assumption: null,
	memoryRef: 'm1',
	copyRef: null,
	...overrides,
})

const logBar = (item: object = barItem()) =>
	({ id: 'c2', name: 'log_food', args: { items: [item], reply: 'Записав батончик.' } }) as const

const BAR_CASE: EvalCase = {
	id: 'bar-by-another-name',
	text: 'Він має іншу назву, пошукай',
	savedFoods: ONE_BAR_FOODS,
	expect: { decision: 'log_or_clarify', findFoodCalled: true, memoryRefs: ['m1'] },
	reference: 'test',
}

/** A model that answers from a script and remembers the messages it was sent. */
const scripted = (
	script: CompletionResponse[],
): { request: RequestFn; sent: AiRequestMessage[][] } => {
	const sent: AiRequestMessage[][] = []
	const request: RequestFn = (_options, messages) => {
		sent.push(messages)
		const next = script[sent.length - 1]
		return next ? Promise.resolve(next) : Promise.reject(new Error('the script ran out'))
	}
	return { request, sent }
}

describe('runCase: read rounds', () => {
	it('answers find_food from the case data, then scores the final log with the found ref', async () => {
		const { request, sent } = scripted([completion([findFood('батончик')]), completion([logBar()])])

		const result = await runCase(BAR_CASE, OPTIONS, request)

		expect(sent).toHaveLength(2)
		const [assistant, tool] = sent[1]?.slice(-2) ?? []
		expect(assistant).toMatchObject({ role: 'assistant', tool_calls: [{ id: 'c1' }] })
		expect(tool).toMatchObject({
			role: 'tool',
			tool_call_id: 'c1',
			content: expect.stringContaining('m1 "Батончик SportyFeel"') as string,
		})
		expect(result.error).toBeNull()
		expect(result.decision).toBe('log')
		expect(result.items[0]?.memoryRef).toBe('m1')
		// the values come from the saved food (376 kcal per 100 g × 45 g), not from the model's 157
		expect(result.kcal).toBeCloseTo(169.2, 1)
		expect(result.reads).toEqual({ steps: 1, findFoodCalls: 1 })
		expect(result.attempts).toBe(1)
		expect(result.rawAttempts?.map(({ isReadStep }) => isReadStep === true)).toEqual([true, false])
		expect(isCaseMemoryCorrect(BAR_CASE, result)).toBe(true)
	})

	it('sums the cost and the tokens of every step', async () => {
		const { request } = scripted([completion([findFood('батончик')]), completion([logBar()])])

		const result = await runCase(BAR_CASE, OPTIONS, request)

		expect(result.costUsd).toBeCloseTo(2 * COST_USD)
		expect(result.inputTokens).toBe(200)
		expect(result.outputTokens).toBe(20)
		expect(result.latencyMs).toBe(10)
	})

	it('rejects a ref the read did not hand out', async () => {
		const wrongRef = logBar(barItem({ memoryRef: 'm9' }))
		const { request } = scripted([
			completion([findFood('батончик')]),
			completion([wrongRef]),
			completion([wrongRef]),
		])

		const result = await runCase(BAR_CASE, OPTIONS, request)

		expect(result.decision).toBe('error')
		expect(result.error).toBe('INVALID_TOOL_CALLS')
		expect(result.reads?.findFoodCalls).toBe(1)
	})

	it('closes reading after MAX_READ_STEPS: the next read is a validation error, then a retry', async () => {
		const { request, sent } = scripted([
			completion([findFood('батончик', 'a')]),
			completion([findFood('батончик', 'b')]),
			completion([findFood('батончик', 'c')]),
			completion([logBar()]),
		])

		const result = await runCase(BAR_CASE, OPTIONS, request)

		expect(sent).toHaveLength(4)
		expect(result.reads).toEqual({ steps: 2, findFoodCalls: 2 })
		expect(result.decision).toBe('log')
		expect(result.wasRetried).toBe(true)
		expect(result.validationErrors[0]?.errors[0]).toContain('find_food: reading is closed')
		expect(result.attempts).toBe(2)
	})

	it('does not read when the model answers at once, and find_food then counts as not called', async () => {
		const plain: EvalCase = {
			id: 'banana',
			text: "з'їв банан 120 г",
			savedFoods: ONE_BAR_FOODS,
			expect: { decision: 'log', findFoodCalled: false },
			reference: 'test',
		}
		const banana = {
			id: 'c1',
			name: 'log_food',
			args: {
				items: [
					barItem({
						name: 'Банан',
						category: 'banana',
						source: 'REFERENCE',
						protein: 1,
						fat: 0,
						carbs: 20,
						kcal: 84,
						memoryRef: null,
					}),
				],
				reply: 'Записав.',
			},
		}
		const { request, sent } = scripted([completion([banana])])

		const result = await runCase(plain, OPTIONS, request)

		expect(sent).toHaveLength(1)
		expect(result.reads).toEqual({ steps: 0, findFoodCalls: 0 })
		expect(isCaseMemoryCorrect(plain, result)).toBe(true)
		expect(
			isCaseMemoryCorrect({ ...plain, expect: { ...plain.expect, findFoodCalled: true } }, result),
		).toBe(false)
	})

	it('answers an invalid find_food call with the error text, so the model can fix it', async () => {
		const { request, sent } = scripted([
			completion([{ id: 'c1', name: 'find_food', args: { query: '' } }]),
			completion([findFood('батончик', 'c3')]),
			completion([logBar()]),
		])

		const result = await runCase(BAR_CASE, OPTIONS, request)

		const firstTool = sent[1]?.at(-1)
		expect(firstTool).toMatchObject({
			role: 'tool',
			content: expect.stringContaining('invalid arguments') as string,
		})
		expect(result.decision).toBe('log')
		expect(result.reads).toEqual({ steps: 2, findFoodCalls: 2 })
	})

	it('puts a second cache point on the user message of every request', async () => {
		const { request, sent } = scripted([completion([findFood('батончик')]), completion([logBar()])])

		await runCase(BAR_CASE, OPTIONS, request)

		const lastUser = sent[0]?.at(-1)
		expect(lastUser).toMatchObject({
			role: 'user',
			content: [{ type: 'text', cache_control: { type: 'ephemeral' } }],
		})
	})
})
