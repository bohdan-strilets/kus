// The OpenRouter request and response for food parsing — shared so the eval sends exactly
// what the backend sends and judges the answer the same way.
import { z } from 'zod'

import type { AiChatMessage } from './context.js'
import type { RawToolCall } from './parse-tool-calls.js'
import { getAiFunctionTools } from './tools.js'

/** Deterministic parsing: the same message should give the same numbers (reasoning models ignore it). */
export const FOOD_PARSE_TEMPERATURE = 0
/**
 * Room for a whole day of food (10+ items) plus the model's reasoning; billed only for what is used.
 * At 2000 a long message was cut mid-answer and came back as `log_food({})`.
 */
export const FOOD_PARSE_MAX_OUTPUT_TOKENS = 8000
/** One more model call when the tool calls fail validation, with the errors fed back. */
export const AI_VALIDATION_RETRY_COUNT = 1

/**
 * Only providers that don't train on or store the data. No `require_parameters`: it filters out
 * every endpoint of models that don't take `temperature` (gpt-6-luna) — those just ignore it.
 */
export const AI_PROVIDER_PREFERENCES = { data_collection: 'deny' } as const

/**
 * `auto`, not `required`: the no-training endpoints of Claude Sonnet 5.5 reject `required`. The
 * prompt demands tool calls, and a text-only answer fails validation and gets the retry.
 */
const TOOL_CHOICE = 'auto'

/**
 * OpenRouter `reasoning` variants (a share of max_tokens, works with adaptive thinking too).
 * No "off": Claude Sonnet 5.5 endpoints answer 400 "Reasoning is mandatory … cannot be disabled".
 */
export const AI_REASONING_MODES = {
	minimal: { effort: 'minimal' },
	low: { effort: 'low' },
} as const

export type AiReasoningMode = keyof typeof AI_REASONING_MODES

/** low vs minimal on 2026-10-07: same kcal error, more right decisions, ~2× faster on long days (PROMPT_CHANGELOG.md). */
export const FOOD_PARSE_REASONING: AiReasoningMode = 'low'

interface FoodParseRequestOptions {
	reasoning?: AiReasoningMode
}

export type AiRequestMessage =
	| AiChatMessage
	| {
			role: 'assistant'
			content: string | null
			tool_calls: { id: string; type: 'function'; function: RawToolCall }[]
	  }
	| { role: 'tool'; tool_call_id: string; content: string }

const tools = getAiFunctionTools()

export const createFoodParseRequest = (
	model: string,
	messages: AiRequestMessage[],
	{ reasoning = FOOD_PARSE_REASONING }: FoodParseRequestOptions = {},
) => ({
	model,
	messages,
	tools,
	tool_choice: TOOL_CHOICE,
	parallel_tool_calls: true,
	temperature: FOOD_PARSE_TEMPERATURE,
	max_tokens: FOOD_PARSE_MAX_OUTPUT_TOKENS,
	reasoning: AI_REASONING_MODES[reasoning],
	provider: AI_PROVIDER_PREFERENCES,
})

/** The part of an OpenAI-compatible chat completion we read; anything else is ignored. */
export const aiCompletionSchema = z.object({
	model: z.string().optional(),
	choices: z
		.array(
			z.object({
				message: z.object({
					content: z.string().nullish(),
					tool_calls: z
						.array(
							z.object({
								id: z.string(),
								function: z.object({ name: z.string(), arguments: z.string() }),
							}),
						)
						.nullish(),
				}),
				// "length" = the answer hit max_tokens and its tool arguments are cut off
				finish_reason: z.string().nullish(),
			}),
		)
		.min(1),
	usage: z
		.object({
			prompt_tokens: z.number().int().nonnegative(),
			completion_tokens: z.number().int().nonnegative(),
			// OpenRouter: USD charged for this request
			cost: z.number().nonnegative().optional(),
			prompt_tokens_details: z
				.object({ cached_tokens: z.number().int().nonnegative().optional() })
				.nullish(),
		})
		.optional(),
})

export type AiCompletion = z.infer<typeof aiCompletionSchema>

/**
 * The answer was cut at max_tokens: its arguments are partial or `{}`. A retry with the same
 * request would be cut the same way, so the caller fails with OUTPUT_TRUNCATED instead.
 */
export const isOutputTruncated = (completion: AiCompletion): boolean =>
	completion.choices[0]?.finish_reason === 'length'

export const getRawToolCalls = (completion: AiCompletion): RawToolCall[] =>
	(completion.choices[0]?.message.tool_calls ?? []).map((call) => call.function)

/** Feeds the rejected answer and the validation errors back, so the retry can fix them. */
export const buildRetryMessages = (
	completion: AiCompletion,
	errors: string[],
): AiRequestMessage[] => {
	const feedback = `Rejected: ${errors.join(' | ')}. Call the tools again with corrected arguments.`
	const message = completion.choices[0]?.message
	const toolCalls = message?.tool_calls ?? []
	if (toolCalls.length === 0) {
		return [
			{ role: 'assistant', content: message?.content ?? '' },
			{ role: 'user', content: feedback },
		]
	}
	return [
		{
			role: 'assistant',
			content: message?.content ?? null,
			tool_calls: toolCalls.map(({ id, function: fn }) => ({ id, type: 'function', function: fn })),
		},
		...toolCalls.map(({ id }): AiRequestMessage => ({
			role: 'tool',
			tool_call_id: id,
			content: feedback,
		})),
	]
}
