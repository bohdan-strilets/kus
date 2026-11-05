import {
	type AiFoodItem,
	type EarlierEntryContext,
	type FoodParseContext,
	type FoodParseDecision,
	getParseRefs,
	type MemoryFoodContext,
	parseToolCalls,
	type RawToolCall,
} from '@kus/shared'

import type { EvalCase } from './cases/index.js'
import type {
	ActualDecision,
	CaseResult,
	LoggedItem,
	RawAttempt,
	ValidationAttempt,
} from './eval.types.js'
import { EMPTY_CALL_FACTS, getCallFacts } from './call-facts.js'
import { getClarifyCalls } from './clarify-calls.js'
import { getEditResult } from './edit-result.js'
import { getLoggedProgram } from './program-result.js'
import { getLoggedWorkouts } from './workout-result.js'
import { getMeasuredItems } from './measurement-result.js'
import { findMixedScriptWords } from './mixed-script.js'

const GRAMS_PER_100 = 100
export const OUTPUT_TRUNCATED = 'OUTPUT_TRUNCATED'
const MAX_VALIDATION_ERROR_LENGTH = 200

export const toValidationAttempt = (
	attempt: number,
	callNames: string[],
	errors: string[],
): ValidationAttempt => ({
	attempt,
	callNames,
	errors: errors.map((text) => text.slice(0, MAX_VALIDATION_ERROR_LENGTH)),
})

export interface ItemSources {
	memory: MemoryFoodContext[]
	earlier: EarlierEntryContext[]
}

/**
 * Per item: a memory item's numbers come from the saved food, scaled by grams; a copy takes the
 * earlier entry's kcal (the model's own number is ignored) — as the backend does.
 */
const getItemTotals = (
	item: AiFoodItem,
	{ memory, earlier }: ItemSources,
): { kcal: number; protein: number } => {
	const copied = earlier.find((entry) => entry.ref === item.copyRef)
	if (copied) return { kcal: copied.kcal, protein: item.protein }
	const food = memory.find((saved) => saved.ref === item.memoryRef)
	if (!food) return { kcal: item.kcal, protein: item.protein }
	const factor = item.grams / GRAMS_PER_100
	return { kcal: food.per100g.kcal * factor, protein: food.per100g.protein * factor }
}

const toLoggedItem = (
	item: AiFoodItem,
	sources: ItemSources,
	messageMealType: string | null,
): LoggedItem => ({
	name: item.name,
	mealType: item.mealType ?? messageMealType,
	grams: item.grams,
	quantity: item.quantity,
	...getItemTotals(item, sources),
	source: item.source,
	memoryRef: item.memoryRef,
	copyRef: item.copyRef,
	assumption: item.assumption,
})

const sumItems = (items: AiFoodItem[], sources: ItemSources) =>
	items.reduce(
		(sum, item) => {
			const totals = getItemTotals(item, sources)
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
			return [decision.log.reply, ...decision.workouts.map(({ reply }) => reply)].join(' ')
		case 'workout':
			return decision.workouts.map(({ reply }) => reply).join(' ')
		case 'not_food':
		case 'photo_unusable':
			return decision.reply
		case 'edit':
		case 'reply':
		case 'day':
		case 'close_day':
		case 'stats':
			return decision.text
		case 'program':
			return decision.program.reply
	}
}

export const failedResult = (
	base: { caseId: string; model: string },
	usage: Pick<
		CaseResult,
		'costUsd' | 'latencyMs' | 'inputTokens' | 'outputTokens' | 'cachedTokens' | 'textOnlyAnswers'
	>,
	{
		error,
		attempts,
		validationErrors = [],
		rawAttempts = [],
	}: {
		error: string
		attempts: number
		validationErrors?: ValidationAttempt[]
		rawAttempts?: RawAttempt[]
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
	workouts: [],
	program: null,
	calls: EMPTY_CALL_FACTS,
	wasRetried: attempts > 1,
	validationErrors,
	mixedScriptWords: [],
	rawAttempts,
})

export interface ScoreInput {
	evalCase: EvalCase
	context: FoodParseContext
	base: { caseId: string; model: string }
	usage: Pick<
		CaseResult,
		'costUsd' | 'latencyMs' | 'inputTokens' | 'outputTokens' | 'cachedTokens' | 'textOnlyAnswers'
	>
	attempt: number
	rawCalls: RawToolCall[]
	validationErrors: ValidationAttempt[]
	rawAttempts: RawAttempt[]
	/** The second call of «summary and advice», when the case made it (see stats-follow-up.ts). */
	statsFollowUp?: { text: string | null }
}

export type ScoreOutcome = { result: CaseResult } | { errors: string[] }

/** One model answer through the current parse/validation and metric extraction (shared by runs and --rescore). */
export const scoreAttempt = (input: ScoreInput): ScoreOutcome => {
	const { evalCase, context, base, usage, attempt, rawCalls, validationErrors, rawAttempts } = input
	const sources: ItemSources = { memory: context.memory, earlier: context.earlier ?? [] }
	const refs = getParseRefs(context)
	const result = parseToolCalls(rawCalls, refs, { hasImage: evalCase.photo !== undefined })
	if (!result.ok) return { errors: result.errors }
	const { statsFollowUp } = input
	// the advice is a reply of the same turn: the reply checks and replyExcludes judge both texts
	const replyText = [getReplyText(result.decision), statsFollowUp?.text]
		.filter((text): text is string => Boolean(text))
		.join(' ')
	const items = getLoggedItems(result.decision)
	const totals = items.length > 0 ? sumItems(items, sources) : null
	return {
		result: {
			...base,
			...usage,
			attempts: attempt,
			decision: toActualDecision(result.decision),
			error: null,
			kcal: totals?.kcal ?? null,
			protein: totals?.protein ?? null,
			categories: items.map((item) => item.category),
			replyText,
			replyAttach: result.decision.kind === 'reply' ? result.decision.attach : null,
			...(statsFollowUp ? { statsFollowUp } : {}),
			edits: getEditResult(result.decision, context),
			measurements: getMeasuredItems(result.decision, context.measurements.today),
			workouts: getLoggedWorkouts(result.decision),
			program: getLoggedProgram(result.decision),
			calls: getCallFacts(rawCalls, context.measurements.today),
			items: items.map((item) =>
				toLoggedItem(
					item,
					sources,
					result.decision.kind === 'log' ? result.decision.log.mealType : null,
				),
			),
			clarifyCalls: getClarifyCalls(rawCalls, result.decision),
			truncated: false,
			wasRetried: attempt > 1,
			validationErrors,
			mixedScriptWords: findMixedScriptWords(replyText),
			rawAttempts,
		},
	}
}
