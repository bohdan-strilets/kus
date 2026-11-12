import {
	AI_VALIDATION_RETRY_COUNT,
	type AiReasoningMode,
	buildFoodParseMessages,
	createFoodParseRequest,
	MAX_READ_STEPS,
} from '@kus/shared'
import { z } from 'zod'

import type { EvalCase } from './cases/index.js'
import { toFoodContext } from './case-context.js'
import { getImageTokens } from './cases/photo.js'
import { OPENROUTER_API_URL } from './openrouter.js'
import { BASE_CONTEXT } from './run-case.js'

/** Calibrated on a real Claude Sonnet 5.5 run (~5100 input tokens per case): Cyrillic + JSON schema. */
const CHARS_PER_TOKEN = 2.2
/** Answer size grows with the message: ~6 tokens of arguments per character of a food list. */
const OUTPUT_TOKENS_BASE = 200
const OUTPUT_TOKENS_PER_TEXT_CHAR = 6
/** Upper bound of thinking per request: low = 0.2, minimal = 0.1 × max_tokens (OpenRouter docs). */
const REASONING_TOKENS: Record<AiReasoningMode, number> = { minimal: 800, low: 1600 }
/** Share of cases expected to need the validation retry (~2× input on those). */
const RETRY_OVERHEAD = 0.15
/**
 * The hard budget reserves a case as if every call happens: the read rounds (find_food) and the
 * validation retry on top of the answer — the same count as run-case.ts.
 */
export const MAX_MODEL_CALLS_PER_CASE = 1 + MAX_READ_STEPS + AI_VALIDATION_RETRY_COUNT
/**
 * Prompt caching, as billed in the 2026-11-10 run (prompt $2/M): a cache write $2.5/M, a read $0.10/M.
 * The prefix (system prompt + tools, ~21k tokens) is written by the first call that meets it cold and
 * read by every later one; cases that start together all pay the write.
 */
export const CACHE_WRITE_RATIO = 1.25
export const CACHE_READ_RATIO = 0.05

const modelsSchema = z.object({
	data: z.array(
		z.object({
			id: z.string(),
			pricing: z.object({ prompt: z.coerce.number(), completion: z.coerce.number() }),
		}),
	),
})

/** USD per token, as OpenRouter /models gives it. */
export interface ModelPrice {
	prompt: number
	completion: number
}

export interface CostEstimate {
	model: string
	promptPerMillion: number
	completionPerMillion: number
	inputTokensPerCase: number
	usdPerRun: number
}

export const fetchPrices = async (): Promise<Map<string, ModelPrice>> => {
	const response = await fetch(`${OPENROUTER_API_URL}/models`, {
		signal: AbortSignal.timeout(30_000),
	})
	if (!response.ok) throw new Error(`OpenRouter /models → HTTP ${response.status}`)
	const { data } = modelsSchema.parse(await response.json())
	return new Map(data.map((model) => [model.id, model.pricing]))
}

interface InputTokens {
	/** The cached part: the system prompt and the tools. */
	prefix: number
	/** What follows the cache breakpoint: context, history, the message, a photo. */
	rest: number
}

/** The words and the tools by their characters; a photo by its patches, not by its base64. */
export const estimateInputParts = (evalCase: EvalCase): InputTokens => {
	const messages = buildFoodParseMessages(
		{ ...BASE_CONTEXT, ...toFoodContext(evalCase.context) },
		evalCase.text,
	)
	const request = createFoodParseRequest('estimate', messages)
	const toTokens = (value: unknown): number =>
		Math.ceil(JSON.stringify(value).length / CHARS_PER_TOKEN)
	const prefix = toTokens({ system: request.messages[0], tools: request.tools })
	const total = toTokens({ messages: request.messages, tools: request.tools })
	const { photo } = evalCase
	return {
		prefix,
		rest: Math.max(total - prefix, 0) + (photo ? getImageTokens(photo.width, photo.height) : 0),
	}
}

const estimateInputTokens = (evalCase: EvalCase): number => {
	const { prefix, rest } = estimateInputParts(evalCase)
	return prefix + rest
}

const estimateOutputTokens = (evalCase: EvalCase, reasoning: AiReasoningMode): number =>
	OUTPUT_TOKENS_BASE +
	evalCase.text.length * OUTPUT_TOKENS_PER_TEXT_CHAR +
	REASONING_TOKENS[reasoning]

/** One case with every call it may make: the first writes the cold prefix, the rest read it. */
export const getCaseUpperBoundUsd = (
	evalCase: EvalCase,
	price: ModelPrice,
	reasoning: AiReasoningMode,
): number => {
	const { prefix, rest } = estimateInputParts(evalCase)
	const output = estimateOutputTokens(evalCase, reasoning) * price.completion
	const restCost = rest * price.prompt
	const coldCall = prefix * price.prompt * CACHE_WRITE_RATIO + restCost + output
	const warmCall = prefix * price.prompt * CACHE_READ_RATIO + restCost + output
	return coldCall + (MAX_MODEL_CALLS_PER_CASE - 1) * warmCall
}

/**
 * What the hard --max-cost reserves before each case: the most expensive case of the set,
 * every call included. An expected upper bound, not max_tokens: that one would stop a run
 * after a handful of cases.
 */
export const getCaseReserveUsd = (
	cases: EvalCase[],
	price: ModelPrice,
	reasoning: AiReasoningMode,
): number => {
	return Math.max(0, ...cases.map((evalCase) => getCaseUpperBoundUsd(evalCase, price, reasoning)))
}

/** Input cost of a run in prompt-price tokens: the first case writes the cached prefix, the rest read it (warm-up). */
const getCachedInputTokens = (cases: EvalCase[]): number =>
	cases.reduce((sum, evalCase, index) => {
		const { prefix, rest } = estimateInputParts(evalCase)
		const prefixRatio = index === 0 ? CACHE_WRITE_RATIO : CACHE_READ_RATIO
		return sum + prefix * prefixRatio + rest
	}, 0)

export const estimateCost = async (
	models: string[],
	cases: EvalCase[],
	reasoning: AiReasoningMode,
): Promise<CostEstimate[]> => {
	const prices = await fetchPrices()
	const inputTokens = cases.reduce((sum, evalCase) => sum + estimateInputTokens(evalCase), 0)
	const billedInputTokens = getCachedInputTokens(cases)
	const outputTokens = cases.reduce(
		(sum, evalCase) => sum + estimateOutputTokens(evalCase, reasoning),
		0,
	)
	return models.map((model) => {
		const price = prices.get(model)
		if (!price) throw new Error(`Model "${model}" is not on OpenRouter`)
		const usd =
			(billedInputTokens * price.prompt + outputTokens * price.completion) * (1 + RETRY_OVERHEAD)
		return {
			model,
			promptPerMillion: price.prompt * 1e6,
			completionPerMillion: price.completion * 1e6,
			inputTokensPerCase: Math.round(inputTokens / Math.max(cases.length, 1)),
			usdPerRun: usd,
		}
	})
}
