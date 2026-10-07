import { buildFoodParseMessages, createFoodParseRequest } from '@kus/shared'
import { z } from 'zod'

import type { EvalCase } from './cases/index.js'
import { OPENROUTER_API_URL } from './openrouter.js'
import { BASE_CONTEXT } from './run-case.js'

/** Calibrated on a real Claude Sonnet 5.5 run (~5100 input tokens per case): Cyrillic + JSON schema. */
const CHARS_PER_TOKEN = 2.2
/** Typical tool-call answer; reasoning models may spend more. */
const OUTPUT_TOKENS_PER_CASE = 450
/** Share of cases expected to need the validation retry (~2× input on those). */
const RETRY_OVERHEAD = 0.15

const modelsSchema = z.object({
	data: z.array(
		z.object({
			id: z.string(),
			pricing: z.object({ prompt: z.coerce.number(), completion: z.coerce.number() }),
		}),
	),
})

export interface CostEstimate {
	model: string
	promptPerMillion: number
	completionPerMillion: number
	inputTokensPerCase: number
	usdPerRun: number
}

const fetchPrices = async (): Promise<Map<string, { prompt: number; completion: number }>> => {
	const response = await fetch(`${OPENROUTER_API_URL}/models`, {
		signal: AbortSignal.timeout(30_000),
	})
	if (!response.ok) throw new Error(`OpenRouter /models → HTTP ${response.status}`)
	const { data } = modelsSchema.parse(await response.json())
	return new Map(data.map((model) => [model.id, model.pricing]))
}

const estimateInputTokens = (evalCase: EvalCase): number => {
	const messages = buildFoodParseMessages({ ...BASE_CONTEXT, ...evalCase.context }, evalCase.text)
	const request = createFoodParseRequest('estimate', messages)
	return Math.ceil(
		JSON.stringify({ messages: request.messages, tools: request.tools }).length / CHARS_PER_TOKEN,
	)
}

export const estimateCost = async (
	models: string[],
	cases: EvalCase[],
): Promise<CostEstimate[]> => {
	const prices = await fetchPrices()
	const inputTokens = cases.reduce((sum, evalCase) => sum + estimateInputTokens(evalCase), 0)
	const outputTokens = cases.length * OUTPUT_TOKENS_PER_CASE
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
