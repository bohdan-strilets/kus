import {
	AI_TOOL_NAMES,
	type AiCompletion,
	type AiRequestMessage,
	buildFoodParseMessages,
	buildStatsAdviceToolResultFromNumbers,
	type FoodParseContext,
	getParseRefs,
	getRawToolCalls,
	hasMemoryActions,
	isOutputTruncated,
	parseToolCalls,
	type RawToolCall,
} from '@kus/shared'

import { type EvalModelOptions, requestFoodParse } from './openrouter.js'

/** The same call id as the backend's second call (ai.service.ts, requestStatsAdvice). */
const STATS_TOOL_CALL_ID = 'call_show_stats'

export const findStatsCall = (rawCalls: RawToolCall[]): RawToolCall | undefined =>
	rawCalls.find((call) => call.name === AI_TOOL_NAMES.showStats)

/** The messages of the second call: the case's own, the model's show_stats call, the counted numbers. */
export const buildStatsFollowUpMessages = (
	context: FoodParseContext,
	text: string,
	statsCall: RawToolCall,
	numbers: string,
): AiRequestMessage[] => [
	...buildFoodParseMessages(context, text),
	{
		role: 'assistant',
		content: null,
		tool_calls: [{ id: STATS_TOOL_CALL_ID, type: 'function', function: statsCall }],
	},
	{
		role: 'tool',
		tool_call_id: STATS_TOOL_CALL_ID,
		content: buildStatsAdviceToolResultFromNumbers(numbers),
	},
]

/** The advice text of the answer: a lone `reply` (as the backend accepts it), else null. */
export const getStatsFollowUpText = (
	completion: AiCompletion,
	context: FoodParseContext,
): string | null => {
	if (isOutputTruncated(completion)) return null
	const result = parseToolCalls(getRawToolCalls(completion), getParseRefs(context), {
		hasImage: false,
	})
	if (!result.ok || result.decision.kind !== 'reply') return null
	const { text, attach, measurements, measurementDeletions, memory } = result.decision
	const hasSideEffects =
		attach !== null ||
		measurements.length > 0 ||
		measurementDeletions.length > 0 ||
		hasMemoryActions(memory)
	return hasSideEffects ? null : text
}

export const requestStatsFollowUp = async (
	options: EvalModelOptions,
	context: FoodParseContext,
	text: string,
	statsCall: RawToolCall,
	numbers: string,
): Promise<{ completion: AiCompletion; latencyMs: number; text: string | null }> => {
	const messages = buildStatsFollowUpMessages(context, text, statsCall, numbers)
	const { completion, latencyMs } = await requestFoodParse(options, messages)
	return { completion, latencyMs, text: getStatsFollowUpText(completion, context) }
}
