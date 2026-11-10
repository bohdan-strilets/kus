import {
	AI_VALIDATION_RETRY_COUNT,
	type AiCompletion,
	type AiRequestMessage,
	buildFoodParseMessages,
	buildRetryMessages,
	type FoodParseContext,
	getRawToolCalls,
	isOutputTruncated,
	isReadToolName,
	MAX_READ_STEPS,
	type RawToolCall,
	shouldShowProgramRules,
	withUserCacheBreakpoint,
} from '@kus/shared'

import { toFoodContext } from './case-context.js'
import { EVAL_TODAY } from './cases/case-builders.js'
import { withDayContext } from './day-context.js'
import type { EvalCase } from './cases/index.js'
import type { CaseResult, RawAttempt, ValidationAttempt } from './eval.types.js'
import { type EvalModelOptions, requestFoodParse } from './openrouter.js'
import { selectPassiveMemory } from './read-fixtures.js'
import {
	answerReads,
	createReadExecutor,
	createReadTurn,
	getReadClosedErrors,
} from './read-loop.js'
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
	// a case with the user's saved foods gets the «Saved foods» block the backend would pick for its words
	const passiveMemory =
		evalCase.savedFoods !== undefined && evalCase.context?.memory === undefined
			? { memory: selectPassiveMemory(evalCase.savedFoods, evalCase.text) }
			: {}
	const context = withDayContext({
		...BASE_CONTEXT,
		...toFoodContext(evalCase.context),
		...passiveMemory,
	})
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

/** One request to the model; the real one is OpenRouter, a test passes its own. */
export type RequestFn = typeof requestFoodParse

/** Every model call of a turn: the read rounds, the answer and its retry (as AiService.parseFood). */
const MAX_MODEL_CALLS = MAX_READ_STEPS + 1 + AI_VALIDATION_RETRY_COUNT

export const runCase = async (
	evalCase: EvalCase,
	options: EvalModelOptions,
	request: RequestFn = requestFoodParse,
): Promise<CaseResult> => {
	const context = buildCaseContext(evalCase)
	let messages: AiRequestMessage[] = withUserCacheBreakpoint(
		buildFoodParseMessages(context, evalCase.text, evalCase.photo),
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
	const readTurn = createReadTurn()
	const executeRead = createReadExecutor(evalCase, context)

	// answers that went through validation (the first and its retry); read rounds do not count
	let attempt = 0
	const validationErrors: ValidationAttempt[] = []
	const rawAttempts: RawAttempt[] = []
	try {
		for (let call = 0; call < MAX_MODEL_CALLS; call += 1) {
			const { completion, latencyMs } = await request(options, messages).catch((error: unknown) => {
				// the failed request belongs to the attempt it was made for
				attempt += 1
				throw error
			})
			addUsage(usage, completion, latencyMs)

			const rawCalls = getRawToolCalls(completion)
			const isTruncated = isOutputTruncated(completion)
			const wantsRead = !isTruncated && rawCalls.some((item) => isReadToolName(item.name))
			rawAttempts.push({
				toolCalls: rawCalls,
				text: completion.choices[0]?.message.content ?? null,
				isTruncated,
				...(wantsRead && readTurn.stats.steps < MAX_READ_STEPS
					? { isReadStep: true as const }
					: {}),
			})
			if (wantsRead && readTurn.stats.steps < MAX_READ_STEPS) {
				messages = [...messages, ...answerReads(readTurn, executeRead, completion)]
				continue
			}

			attempt += 1
			// same rule as the backend: a cut-off answer is not retried
			if (isTruncated)
				return failedResult(base, usage, {
					error: OUTPUT_TRUNCATED,
					attempts: attempt,
					validationErrors,
					rawAttempts,
					reads: readTurn.stats,
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
				reads: readTurn,
			}
			// a read once reading is closed is a validation error: «answer now»
			const outcome = wantsRead
				? { errors: getReadClosedErrors(rawCalls) }
				: scoreAttempt(scoreInput)
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
					rawCalls.map((item) => item.name),
					outcome.errors,
				),
			)
			if (attempt >= 1 + AI_VALIDATION_RETRY_COUNT) break
			messages = [...messages, ...buildRetryMessages(completion, outcome.errors)]
		}
		return failedResult(base, usage, {
			error: 'INVALID_TOOL_CALLS',
			attempts: attempt,
			validationErrors,
			rawAttempts,
			reads: readTurn.stats,
		})
	} catch (error) {
		return failedResult(base, usage, {
			error: error instanceof Error ? error.message.slice(0, 200) : 'UNKNOWN',
			attempts: attempt,
			validationErrors,
			rawAttempts,
			reads: readTurn.stats,
		})
	}
}
