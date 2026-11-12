// The messages between two model calls of a read round: the model's tool calls and one tool result
// for each. Shared, so the backend and the eval build the same follow-up request.
import {
	isReadToolName,
	MAX_PARALLEL_READS,
	READ_NOT_EXECUTED_RESULT,
	WRITE_NOT_EXECUTED_RESULT,
} from './read-tools.js'
import type { AiCompletion, AiRequestMessage } from './request.js'

export type ModelToolCall = NonNullable<
	AiCompletion['choices'][number]['message']['tool_calls']
>[number]

export interface SplitToolCalls {
	/** Read calls that run now (at most MAX_PARALLEL_READS). */
	reads: ModelToolCall[]
	/** Read calls over the parallel limit. */
	skippedReads: ModelToolCall[]
	/** Write calls of a mixed answer: not executed, they come again after the reading. */
	writes: ModelToolCall[]
}

export const splitToolCalls = (toolCalls: ModelToolCall[]): SplitToolCalls => {
	const allReads = toolCalls.filter((call) => isReadToolName(call.function.name))
	return {
		reads: allReads.slice(0, MAX_PARALLEL_READS),
		skippedReads: allReads.slice(MAX_PARALLEL_READS),
		writes: toolCalls.filter((call) => !isReadToolName(call.function.name)),
	}
}

/**
 * The model's answer as the next messages: its tool calls, then one tool result for every call id
 * (the format requires an answer for each), in the order the model sent them.
 */
export const buildReadStepMessages = (
	completion: AiCompletion,
	toolCalls: ModelToolCall[],
	resultById: ReadonlyMap<string, { text: string }>,
): AiRequestMessage[] => [
	{
		role: 'assistant',
		content: completion.choices[0]?.message.content ?? null,
		tool_calls: toolCalls.map(({ id, function: fn }) => ({ id, type: 'function', function: fn })),
	},
	...toolCalls.map(({ id, function: fn }): AiRequestMessage => {
		const result = resultById.get(id)
		return {
			role: 'tool',
			tool_call_id: id,
			content:
				result?.text ??
				(isReadToolName(fn.name) ? READ_NOT_EXECUTED_RESULT : WRITE_NOT_EXECUTED_RESULT),
		}
	}),
]

/**
 * A third cache point, on the user's message (after the prompt and the day's history): the read
 * step's request then reads the whole input of the first one from the cache. At most 3 points in
 * all, Anthropic allows 4. A message ending in a photo is left alone (the cache point needs text).
 */
export const withUserCacheBreakpoint = (messages: AiRequestMessage[]): AiRequestMessage[] => {
	const last = messages.at(-1)
	if (last?.role !== 'user') return messages
	const head = messages.slice(0, -1)
	if (typeof last.content === 'string') {
		return [
			...head,
			{
				role: 'user',
				content: [{ type: 'text', text: last.content, cache_control: { type: 'ephemeral' } }],
			},
		]
	}
	const lastPart = last.content.at(-1)
	if (lastPart?.type !== 'text') return messages
	return [
		...head,
		{
			role: 'user',
			content: [
				...last.content.slice(0, -1),
				{ ...lastPart, cache_control: { type: 'ephemeral' } },
			],
		},
	]
}
