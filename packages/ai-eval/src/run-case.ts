import {
	AI_VALIDATION_RETRY_COUNT,
	type AiRequestMessage,
	buildFoodParseMessages,
	buildRetryMessages,
	type FoodParseContext,
	getRawToolCalls,
	isOutputTruncated,
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
	scoreAttempt,
	toValidationAttempt,
} from './score-attempt.js'

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
			usage.latencyMs += latencyMs
			usage.costUsd += completion.usage?.cost ?? 0
			usage.inputTokens += completion.usage?.prompt_tokens ?? 0
			usage.outputTokens += completion.usage?.completion_tokens ?? 0
			usage.cachedTokens += completion.usage?.prompt_tokens_details?.cached_tokens ?? 0

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
			const outcome = scoreAttempt({
				evalCase,
				context,
				base,
				usage,
				attempt,
				rawCalls,
				validationErrors,
				rawAttempts,
			})
			if ('result' in outcome) return outcome.result
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
