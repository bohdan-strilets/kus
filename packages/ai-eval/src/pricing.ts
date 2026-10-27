import {
	AI_VALIDATION_RETRY_COUNT,
	type AiReasoningMode,
	buildFoodParseMessages,
	createFoodParseRequest,
} from '@kus/shared'
import { z } from 'zod'

import type { EvalCase } from './cases/index.js'
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
/** The hard budget reserves a case as if every allowed validation retry happens. */
const MAX_ATTEMPTS_PER_CASE = 1 + AI_VALIDATION_RETRY_COUNT

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

/** The words and the tools by their characters; a photo by its patches, not by its base64. */
const estimateInputTokens = (evalCase: EvalCase): number => {
	const messages = buildFoodParseMessages({ ...BASE_CONTEXT, ...evalCase.context }, evalCase.text)
	const request = createFoodParseRequest('estimate', messages)
	const textTokens = Math.ceil(
		JSON.stringify({ messages: request.messages, tools: request.tools }).length / CHARS_PER_TOKEN,
	)
	const { photo } = evalCase
	return textTokens + (photo ? getImageTokens(photo.width, photo.height) : 0)
}

const estimateOutputTokens = (evalCase: EvalCase, reasoning: AiReasoningMode): number =>
	OUTPUT_TOKENS_BASE +
	evalCase.text.length * OUTPUT_TOKENS_PER_TEXT_CHAR +
	REASONING_TOKENS[reasoning]

/**
 * What the hard --max-cost reserves before each case: the most expensive case of the set,
 * every attempt included. An expected upper bound, not max_tokens: that one would stop a run
 * after a handful of cases.
 */
export const getCaseReserveUsd = (
	cases: EvalCase[],
	price: ModelPrice,
	reasoning: AiReasoningMode,
): number => {
	const costs = cases.map(
		(evalCase) =>
			estimateInputTokens(evalCase) * price.prompt +
			estimateOutputTokens(evalCase, reasoning) * price.completion,
	)
	return Math.max(0, ...costs) * MAX_ATTEMPTS_PER_CASE
}

export const estimateCost = async (
	models: string[],
	cases: EvalCase[],
	reasoning: AiReasoningMode,
): Promise<CostEstimate[]> => {
	const prices = await fetchPrices()
	const inputTokens = cases.reduce((sum, evalCase) => sum + estimateInputTokens(evalCase), 0)
	const outputTokens = cases.reduce(
		(sum, evalCase) => sum + estimateOutputTokens(evalCase, reasoning),
		0,
	)
	return models.map((model) => {
		const price = prices.get(model)
		if (!price) throw new Error(`Model "${model}" is not on OpenRouter`)
		const usd =
			(inputTokens * price.prompt + outputTokens * price.completion) * (1 + RETRY_OVERHEAD)
		return {
			model,
			promptPerMillion: price.prompt * 1e6,
			completionPerMillion: price.completion * 1e6,
			inputTokensPerCase: Math.round(inputTokens / Math.max(cases.length, 1)),
			usdPerRun: usd,
		}
	})
}
