import {
	AI_VALIDATION_RETRY_COUNT,
	type AiFoodItem,
	type AiRequestMessage,
	buildFoodParseMessages,
	buildRetryMessages,
	type FoodParseContext,
	type FoodParseDecision,
	getParseRefs,
	getRawToolCalls,
	isOutputTruncated,
	type MemoryFoodContext,
	parseToolCalls,
} from '@kus/shared'

import { EVAL_TODAY } from './cases/case-builders.js'
import { withDayContext } from './day-context.js'
import type { EvalCase } from './cases/index.js'
import type { ActualDecision, CaseResult, LoggedItem, ValidationAttempt } from './eval.types.js'
import { EMPTY_CALL_FACTS, getCallFacts } from './call-facts.js'
import { getClarifyCalls } from './clarify-calls.js'
import { getEditResult } from './edit-result.js'
import { getMeasuredItems } from './measurement-result.js'
import { findMixedScriptWords } from './mixed-script.js'
import { type EvalModelOptions, requestFoodParse } from './openrouter.js'

/** Fixed clock, so meal-type guesses and reruns compare like for like. */
export const BASE_CONTEXT: FoodParseContext = {
	localTime: '2026-10-07 13:20, Wednesday',
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

const GRAMS_PER_100 = 100
const OUTPUT_TRUNCATED = 'OUTPUT_TRUNCATED'
const MAX_VALIDATION_ERROR_LENGTH = 200

const toValidationAttempt = (
	attempt: number,
	callNames: string[],
	errors: string[],
): ValidationAttempt => ({
	attempt,
	callNames,
	errors: errors.map((text) => text.slice(0, MAX_VALIDATION_ERROR_LENGTH)),
})

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

const toLoggedItem = (
	item: AiFoodItem,
	memory: MemoryFoodContext[],
	messageMealType: string | null,
): LoggedItem => ({
	name: item.name,
	mealType: item.mealType ?? messageMealType,
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
	if (decision.kind === 'day') return 'day_card'
	if (decision.kind !== 'log') return decision.kind
	return decision.clarifications.length > 0 ? 'clarify' : 'log'
}

const getLoggedItems = (decision: FoodParseDecision) =>
	decision.kind === 'log' ? decision.log.items : []

const getReplyText = (decision: FoodParseDecision): string => {
	switch (decision.kind) {
		case 'log':
			return decision.log.reply
		case 'not_food':
		case 'photo_unusable':
			return decision.reply
		case 'edit':
		case 'reply':
		case 'day':
			return decision.text
	}
}

const failedResult = (
	base: { caseId: string; model: string },
	usage: Pick<
		CaseResult,
		'costUsd' | 'latencyMs' | 'inputTokens' | 'outputTokens' | 'cachedTokens' | 'textOnlyAnswers'
	>,
	{
		error,
		attempts,
		validationErrors = [],
	}: {
		error: string
		attempts: number
		validationErrors?: ValidationAttempt[]
	},
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
	edits: null,
	measurements: [],
	calls: EMPTY_CALL_FACTS,
	wasRetried: attempts > 1,
	validationErrors,
	mixedScriptWords: [],
})

export const runCase = async (
	evalCase: EvalCase,
	options: EvalModelOptions,
): Promise<CaseResult> => {
	const context = withDayContext({ ...BASE_CONTEXT, ...evalCase.context })
	const { memory } = context
	const refs = getParseRefs(context)
	let messages: AiRequestMessage[] = buildFoodParseMessages(context, evalCase.text, evalCase.photo)
	const hasImage = evalCase.photo !== undefined
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
				return failedResult(base, usage, {
					error: OUTPUT_TRUNCATED,
					attempts: attempt,
					validationErrors,
				})
			const rawCalls = getRawToolCalls(completion)
			if (rawCalls.length === 0) usage.textOnlyAnswers += 1
			const result = parseToolCalls(rawCalls, refs, { hasImage })
			if (result.ok) {
				const replyText = getReplyText(result.decision)
				const items = getLoggedItems(result.decision)
				const totals = items.length > 0 ? sumItems(items, memory) : null
				const calls = getCallFacts(rawCalls, context.measurements.today)
				return {
					...base,
					...usage,
					attempts: attempt,
					decision: toActualDecision(result.decision),
					error: null,
					kcal: totals?.kcal ?? null,
					protein: totals?.protein ?? null,
					categories: items.map((item) => item.category),
					replyText,
					edits: getEditResult(result.decision, context),
					measurements: getMeasuredItems(result.decision, context.measurements.today),
					calls,
					items: items.map((item) =>
						toLoggedItem(
							item,
							memory,
							result.decision.kind === 'log' ? result.decision.log.mealType : null,
						),
					),
					clarifyCalls: getClarifyCalls(rawCalls, result.decision),
					truncated: false,
					wasRetried: attempt > 1,
					validationErrors,
					mixedScriptWords: findMixedScriptWords(replyText),
				}
			}
			validationErrors.push(
				toValidationAttempt(
					attempt,
					rawCalls.map((call) => call.name),
					result.errors,
				),
			)
			messages = [...messages, ...buildRetryMessages(completion, result.errors)]
		}
		return failedResult(base, usage, {
			error: 'INVALID_TOOL_CALLS',
			attempts: 1 + AI_VALIDATION_RETRY_COUNT,
			validationErrors,
		})
	} catch (error) {
		return failedResult(base, usage, {
			error: error instanceof Error ? error.message.slice(0, 200) : 'UNKNOWN',
			attempts: attemptsMade,
			validationErrors,
		})
	}
}
