import {
	AI_VALIDATION_RETRY_COUNT,
	type AiFoodItem,
	type AiRequestMessage,
	buildFoodParseMessages,
	buildRetryMessages,
	type FoodParseContext,
	type FoodParseDecision,
	getRawToolCalls,
	isOutputTruncated,
	type MemoryFoodContext,
	parseToolCalls,
} from '@kus/shared'

import type { EvalCase } from './cases/index.js'
import type { ActualDecision, CaseResult, LoggedItem } from './eval.types.js'
import { getClarifyCalls } from './clarify-calls.js'
import { type EvalModelOptions, requestFoodParse } from './openrouter.js'

/** Fixed clock, so meal-type guesses and reruns compare like for like. */
export const BASE_CONTEXT: FoodParseContext = {
	localTime: '2026-10-07 13:20, Wednesday',
	dayTotals: { kcal: 0, protein: 0, fat: 0, carbs: 0 },
	meals: [],
	goal: null,
	memory: [],
	history: [],
}

const GRAMS_PER_100 = 100
const OUTPUT_TRUNCATED = 'OUTPUT_TRUNCATED'

/** Per item: a memory item's numbers come from the saved food, scaled by grams — as the backend does. */
const getItemTotals = (
	item: AiFoodItem,
	memory: MemoryFoodContext[],
): { kcal: number; protein: number } => {
	const food = memory.find((saved) => saved.ref === item.memoryRef)
	if (!food) return { kcal: item.kcal, protein: item.protein }
	const factor = item.grams / GRAMS_PER_100
	return { kcal: food.per100g.kcal * factor, protein: food.per100g.protein * factor }
}

const toLoggedItem = (item: AiFoodItem, memory: MemoryFoodContext[]): LoggedItem => ({
	name: item.name,
	grams: item.grams,
	quantity: item.quantity,
	...getItemTotals(item, memory),
	source: item.source,
	memoryRef: item.memoryRef,
	assumption: item.assumption,
})

const sumItems = (items: AiFoodItem[], memory: MemoryFoodContext[]) =>
	items.reduce(
		(sum, item) => {
			const totals = getItemTotals(item, memory)
			return { kcal: sum.kcal + totals.kcal, protein: sum.protein + totals.protein }
		},
		{ kcal: 0, protein: 0 },
	)

const toActualDecision = (decision: FoodParseDecision): ActualDecision => {
	if (decision.kind !== 'log') return decision.kind
	return decision.clarifications.length > 0 ? 'clarify' : 'log'
}

const getLoggedItems = (decision: FoodParseDecision) =>
	decision.kind === 'log' ? decision.log.items : []

const failedResult = (
	base: { caseId: string; model: string },
	usage: Pick<
		CaseResult,
		'costUsd' | 'latencyMs' | 'inputTokens' | 'outputTokens' | 'cachedTokens' | 'textOnlyAnswers'
	>,
	{ error, attempts }: { error: string; attempts: number },
): CaseResult => ({
	...base,
	...usage,
	attempts,
	decision: 'error',
	error,
	truncated: error === OUTPUT_TRUNCATED,
	items: [],
	clarifyCalls: [],
	kcal: null,
	protein: null,
	categories: [],
	replyText: null,
	wasRetried: attempts > 1,
})

export const runCase = async (
	evalCase: EvalCase,
	options: EvalModelOptions,
): Promise<CaseResult> => {
	const memory = evalCase.context?.memory ?? []
	const memoryRefs = new Set(memory.map((food) => food.ref))
	let messages: AiRequestMessage[] = buildFoodParseMessages(
		{ ...BASE_CONTEXT, ...evalCase.context },
		evalCase.text,
	)
	const usage = {
		costUsd: 0,
		latencyMs: 0,
		inputTokens: 0,
		outputTokens: 0,
		cachedTokens: 0,
		textOnlyAnswers: 0,
	}
	const base = { caseId: evalCase.id, model: options.model }

	let attemptsMade = 0
	try {
		for (let attempt = 1; attempt <= 1 + AI_VALIDATION_RETRY_COUNT; attempt += 1) {
			attemptsMade = attempt
			const { completion, latencyMs } = await requestFoodParse(options, messages)
			usage.latencyMs += latencyMs
			usage.costUsd += completion.usage?.cost ?? 0
			usage.inputTokens += completion.usage?.prompt_tokens ?? 0
			usage.outputTokens += completion.usage?.completion_tokens ?? 0
			usage.cachedTokens += completion.usage?.prompt_tokens_details?.cached_tokens ?? 0

			// same rule as the backend: a cut-off answer is not retried
			if (isOutputTruncated(completion))
				return failedResult(base, usage, { error: OUTPUT_TRUNCATED, attempts: attempt })
			const rawCalls = getRawToolCalls(completion)
			if (rawCalls.length === 0) usage.textOnlyAnswers += 1
			const result = parseToolCalls(rawCalls, { memoryRefs })
			if (result.ok) {
				const items = getLoggedItems(result.decision)
				const totals = items.length > 0 ? sumItems(items, memory) : null
				return {
					...base,
					...usage,
					attempts: attempt,
					decision: toActualDecision(result.decision),
					error: null,
					kcal: totals?.kcal ?? null,
					protein: totals?.protein ?? null,
					categories: items.map((item) => item.category),
					replyText: result.decision.kind === 'reply' ? result.decision.text : null,
					items: items.map((item) => toLoggedItem(item, memory)),
					clarifyCalls: getClarifyCalls(rawCalls, result.decision),
					truncated: false,
					wasRetried: attempt > 1,
				}
			}
			messages = [...messages, ...buildRetryMessages(completion, result.errors)]
		}
		return failedResult(base, usage, {
			error: 'INVALID_TOOL_CALLS',
			attempts: 1 + AI_VALIDATION_RETRY_COUNT,
		})
	} catch (error) {
		return failedResult(base, usage, {
			error: error instanceof Error ? error.message.slice(0, 200) : 'UNKNOWN',
			attempts: attemptsMade,
		})
	}
}
