import type { FoodParseContext } from '@kus/shared'
import { vi } from 'vitest'

import type { AiClient } from './ai-client'

export interface FakeToolCall {
	name: string
	/** Object → JSON-encoded; string → sent as is (to fake broken JSON). */
	args: unknown
}

interface CompletionOptions {
	costUsd?: number
	content?: string | null
	/** "length" fakes an answer cut at max_tokens. */
	finishReason?: string
}

export const createCompletion = (
	calls: FakeToolCall[],
	{ costUsd = 0.002, content = null, finishReason = 'tool_calls' }: CompletionOptions = {},
) => ({
	model: 'test/model',
	choices: [
		{
			message: {
				content,
				tool_calls: calls.map(({ name, args }, index) => ({
					id: `call_${index}`,
					type: 'function',
					function: {
						name,
						arguments: typeof args === 'string' ? args : JSON.stringify(args),
					},
				})),
			},
			finish_reason: finishReason,
		},
	],
	usage: {
		prompt_tokens: 3000,
		completion_tokens: 300,
		cost: costUsd,
		prompt_tokens_details: { cached_tokens: 0 },
	},
})

/** 3 boiled eggs + 100 g cooked buckwheat, values from USDA-style references. */
export const EGGS_AND_BUCKWHEAT_ITEMS = [
	{
		name: 'Яйце варене',
		grams: 150,
		quantity: 3,
		kcal: 233,
		protein: 18.9,
		fat: 15.9,
		carbs: 1.7,
		fiber: 0,
		category: 'eggs',
		source: 'REFERENCE',
		confidence: 0.9,
		assumption: '3 яйця по ~50 г',
		memoryRef: null,
	},
	{
		name: 'Гречка варена',
		grams: 100,
		quantity: null,
		kcal: 110,
		protein: 4.2,
		fat: 1.1,
		carbs: 19.9,
		fiber: 2.7,
		category: 'porridge',
		source: 'REFERENCE',
		confidence: 0.8,
		assumption: 'варена',
		memoryRef: null,
	},
]

export const logFoodCall = (items: unknown[] = EGGS_AND_BUCKWHEAT_ITEMS): FakeToolCall => ({
	name: 'log_food',
	args: { items, mealType: null, reply: 'Записав!' },
})

export const SOUP_ITEM = {
	name: 'Суп',
	grams: 300,
	quantity: null,
	kcal: 150,
	protein: 6,
	fat: 6,
	carbs: 18,
	fiber: null,
	category: 'soup',
	source: 'ESTIMATE',
	confidence: 0.4,
	assumption: 'тарілка ≈ 300 г, овочевий',
	memoryRef: null,
}

export const soupClarifyCall: FakeToolCall = {
	name: 'clarify',
	args: {
		question: 'Який суп і яка тарілка?',
		itemIndexes: [0],
		options: [
			{ label: 'Овочевий', kcal: 150, protein: 6, fat: 6, carbs: 18, fiber: null, grams: null },
			{ label: 'Харчо', kcal: 330, protein: 18, fat: 18, carbs: 24, fiber: null, grams: null },
		],
	},
}

/** A clarify answer whose values add up (all kcal from carbs) — for tests about the flow. */
export const clarifyOption = (label: string, kcal: number) => ({
	label,
	kcal,
	protein: 0,
	fat: 0,
	carbs: kcal / 4,
	fiber: null,
	grams: null,
})

/** What a long day message looked like at max_tokens 2000: the arguments cut down to `{}`. */
export const TRUNCATED_COMPLETION = createCompletion([{ name: 'log_food', args: {} }], {
	finishReason: 'length',
})

/** Kcal far from 4/4/9 of the macros — the backend must reject it. */
export const INVALID_ITEM = { ...SOUP_ITEM, kcal: 900 }

/** Returns queued responses (or throws queued errors) in order and records each request body. */
export const createFakeAiClient = () => {
	const queue: unknown[] = []
	const bodies: unknown[] = []
	const client: AiClient = {
		post: vi.fn((_path: string, { body }: { body: unknown }) => {
			bodies.push(body)
			const next = queue.shift()
			if (next instanceof Error) return Promise.reject(next)
			if (next === undefined) return Promise.reject(new Error('Fake AI client: queue is empty'))
			return Promise.resolve(next)
		}),
	}
	return {
		client,
		bodies,
		respond: (...responses: unknown[]) => {
			queue.push(...responses)
		},
		reset: () => {
			queue.length = 0
			bodies.length = 0
		},
	}
}

export type FakeAiClient = ReturnType<typeof createFakeAiClient>

export const EMPTY_CONTEXT: FoodParseContext = {
	localTime: '2026-10-07 13:20, Wednesday',
	dayTotals: { kcal: 0, protein: 0, fat: 0, carbs: 0 },
	meals: [],
	entries: [],
	deletedEntries: [],
	openClarifications: [],
	goal: null,
	memory: [],
	history: [],
}
