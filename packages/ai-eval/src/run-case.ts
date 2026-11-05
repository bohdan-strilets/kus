import {
	AI_VALIDATION_RETRY_COUNT,
	type AiCompletion,
	type AiRequestMessage,
	buildFoodParseMessages,
	buildRetryMessages,
	type FoodParseContext,
	getRawToolCalls,
	isOutputTruncated,
	type RawToolCall,
	shouldShowProgramRules,
} from '@kus/shared'

import { toFoodContext } from './case-context.js'
import { EVAL_TODAY } from './cases/case-builders.js'
import { withDayContext } from './day-context.js'
import type { EvalCase } from './cases/index.js'
import type { CaseResult, RawAttempt, ValidationAttempt } from './eval.types.js'
import { type EvalModelOptions, requestFoodParse } from './openrouter.js'
import {
	failedResult,
	OUTPUT_TRUNCATED,
	type ScoreInput,
	scoreAttempt,
	toValidationAttempt,
} from './score-attempt.js'
import { findStatsCall, requestStatsFollowUp } from './stats-follow-up.js'

/** Fixed clock, so meal-type guesses and reruns compare like for like. */
export const BASE_CONTEXT: FoodParseContext = {
	localTime: '2026-10-07 13:20, Wednesday',
	// the backend always says it; neutral unless a case is about the user's gender
	addressForm: 'NEUTRAL',
	dayTotals: { kcal: 0, protein: 0, fat: 0, carbs: 0 },
	meals: [],
	entries: [],
	deletedEntries: [],
	openClarifications: [],
	goal: null,
	measurements: { today: EVAL_TODAY, weights: [], waist: null, targetWeightKg: null },
	memory: [],
	history: [],
}

/** The model context of a case, as the backend builds it (the «Program» rules decided the same way). */
export const buildCaseContext = (evalCase: EvalCase): FoodParseContext => {
	const context = withDayContext({ ...BASE_CONTEXT, ...toFoodContext(evalCase.context) })
	const hasProgramRules = shouldShowProgramRules({
		text: evalCase.text,
		history: context.history,
		hasProgram: Boolean(context.program) || Boolean(context.pendingProgram),
	})
	return hasProgramRules ? { ...context, hasProgramRules } : context
}

type Usage = Pick<
	CaseResult,
	'costUsd' | 'latencyMs' | 'inputTokens' | 'outputTokens' | 'cachedTokens' | 'textOnlyAnswers'
>

const addUsage = (usage: Usage, completion: AiCompletion, latencyMs: number): void => {
	usage.latencyMs += latencyMs
	usage.costUsd += completion.usage?.cost ?? 0
	usage.inputTokens += completion.usage?.prompt_tokens ?? 0
	usage.outputTokens += completion.usage?.completion_tokens ?? 0
	usage.cachedTokens += completion.usage?.prompt_tokens_details?.cached_tokens ?? 0
}

interface StatsFollowUpInput {
	evalCase: EvalCase
	context: FoodParseContext
	options: EvalModelOptions
	usage: Usage
	rawCalls: RawToolCall[]
	result: CaseResult
}

/**
 * The backend's second call for «summary and advice»: only for a case with `statsNumbers` whose
 * answer is show_stats with advice: true. Without `statsNumbers` the case runs as before.
 */
const getStatsFollowUp = async ({
	evalCase,
	context,
	options,
	usage,
	rawCalls,
	result,
}: StatsFollowUpInput): Promise<{ text: string | null } | null> => {
	const numbers = evalCase.expect.statsNumbers
	const statsCall = findStatsCall(rawCalls)
	if (numbers === undefined || !statsCall) return null
	if (result.decision !== 'stats' || !result.calls.statsCards.some(({ advice }) => advice)) {
		return null
	}
	const followUp = await requestStatsFollowUp(options, context, evalCase.text, statsCall, numbers)
	addUsage(usage, followUp.completion, followUp.latencyMs)
	return { text: followUp.text }
}

export const runCase = async (
	evalCase: EvalCase,
	options: EvalModelOptions,
): Promise<CaseResult> => {
	const context = buildCaseContext(evalCase)
	let messages: AiRequestMessage[] = buildFoodParseMessages(context, evalCase.text, evalCase.photo)
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
	const validationErrors: ValidationAttempt[] = []
	const rawAttempts: RawAttempt[] = []
	try {
		for (let attempt = 1; attempt <= 1 + AI_VALIDATION_RETRY_COUNT; attempt += 1) {
			attemptsMade = attempt
			const { completion, latencyMs } = await requestFoodParse(options, messages)
			addUsage(usage, completion, latencyMs)

			const rawCalls = getRawToolCalls(completion)
			const isTruncated = isOutputTruncated(completion)
			rawAttempts.push({
				toolCalls: rawCalls,
				text: completion.choices[0]?.message.content ?? null,
				isTruncated,
			})
			// same rule as the backend: a cut-off answer is not retried
			if (isTruncated)
				return failedResult(base, usage, {
					error: OUTPUT_TRUNCATED,
					attempts: attempt,
					validationErrors,
					rawAttempts,
				})
			if (rawCalls.length === 0) usage.textOnlyAnswers += 1
			const scoreInput: ScoreInput = {
				evalCase,
				context,
				base,
				usage,
				attempt,
				rawCalls,
				validationErrors,
				rawAttempts,
			}
			const outcome = scoreAttempt(scoreInput)
			if ('result' in outcome) {
				const statsFollowUp = await getStatsFollowUp({
					evalCase,
					context,
					options,
					usage,
					rawCalls,
					result: outcome.result,
				})
				if (!statsFollowUp) return outcome.result
				// scored again with the advice: the usage now includes the second call
				const withAdvice = scoreAttempt({ ...scoreInput, statsFollowUp })
				return 'result' in withAdvice ? withAdvice.result : outcome.result
			}
			validationErrors.push(
				toValidationAttempt(
					attempt,
					rawCalls.map((call) => call.name),
					outcome.errors,
				),
			)
			messages = [...messages, ...buildRetryMessages(completion, outcome.errors)]
		}
		return failedResult(base, usage, {
			error: 'INVALID_TOOL_CALLS',
			attempts: 1 + AI_VALIDATION_RETRY_COUNT,
			validationErrors,
			rawAttempts,
		})
	} catch (error) {
		return failedResult(base, usage, {
			error: error instanceof Error ? error.message.slice(0, 200) : 'UNKNOWN',
			attempts: attemptsMade,
			validationErrors,
			rawAttempts,
		})
	}
}
