// Validates what the model returned. Shared by the backend and the eval, so both judge the same way.
import type { z } from 'zod'

import type { ToolCallStatus } from '../schemas/enums.js'
import {
	AI_TOOL_NAMES,
	AI_TOOL_SCHEMAS,
	type AiToolName,
	type ClarifyInput,
	clarifyInputSchema,
	type LogFoodInput,
	logFoodInputSchema,
	type NotFoodInput,
	notFoodInputSchema,
	type ReplyInput,
	replyInputSchema,
} from './tools.js'
import { type ClarificationResult, selectClarifications } from './clarifications.js'

/** Hints appended to validation errors so the model can fix them on the retry. */
const ERROR_HINTS: Record<string, string> = {
	KCAL_DENSITY_TOO_HIGH: 'kcal per gram is above 9.5 — check grams and kcal',
	MACROS_KCAL_MISMATCH:
		'kcal does not match 4·protein + 4·carbs + 9·fat + 2·fiber — fix the numbers (labels may differ up to 30%)',
}

export interface RawToolCall {
	name: string
	/** JSON string, as in OpenAI-compatible responses. */
	arguments: string
}

export interface ParsedToolCall {
	name: string
	input: unknown
	status: Extract<ToolCallStatus, 'SUCCEEDED' | 'REJECTED'>
	error: string | null
}

export type FoodParseDecision =
	| { kind: 'log'; log: LogFoodInput; clarifications: ClarificationResult[] }
	| { kind: 'not_food'; reply: string }
	| { kind: 'reply'; text: string }

export type FoodParseResult =
	| { ok: true; decision: FoodParseDecision; calls: ParsedToolCall[] }
	| { ok: false; errors: string[]; calls: ParsedToolCall[] }

export interface ParseToolCallsOptions {
	/** Memory refs given to the model in this request; anything else is invented. */
	memoryRefs: ReadonlySet<string>
}

type ValidatedCall =
	| { name: typeof AI_TOOL_NAMES.logFood; data: LogFoodInput }
	| { name: typeof AI_TOOL_NAMES.clarify; data: ClarifyInput }
	| { name: typeof AI_TOOL_NAMES.notFood; data: NotFoodInput }
	| { name: typeof AI_TOOL_NAMES.reply; data: ReplyInput }

type InputParse = { ok: true; call: ValidatedCall } | { ok: false; error: z.ZodError }

const isToolName = (name: string): name is AiToolName => Object.hasOwn(AI_TOOL_SCHEMAS, name)

const parseInput = (name: AiToolName, value: unknown): InputParse => {
	switch (name) {
		case AI_TOOL_NAMES.logFood: {
			const result = logFoodInputSchema.safeParse(value)
			return result.success
				? { ok: true, call: { name, data: result.data } }
				: { ok: false, error: result.error }
		}
		case AI_TOOL_NAMES.clarify: {
			const result = clarifyInputSchema.safeParse(value)
			return result.success
				? { ok: true, call: { name, data: result.data } }
				: { ok: false, error: result.error }
		}
		case AI_TOOL_NAMES.notFood: {
			const result = notFoodInputSchema.safeParse(value)
			return result.success
				? { ok: true, call: { name, data: result.data } }
				: { ok: false, error: result.error }
		}
		case AI_TOOL_NAMES.reply: {
			const result = replyInputSchema.safeParse(value)
			return result.success
				? { ok: true, call: { name, data: result.data } }
				: { ok: false, error: result.error }
		}
	}
}

const formatZodError = (error: z.ZodError): string =>
	error.issues
		.map((issue) => {
			const path = issue.path.join('.') || '(root)'
			return `${path}: ${ERROR_HINTS[issue.message] ?? issue.message}`
		})
		.join('; ')

const parseJson = (text: string): { ok: true; value: unknown } | { ok: false } => {
	try {
		return { ok: true, value: JSON.parse(text) as unknown }
	} catch {
		// the caller reports invalid JSON to the model as a validation error
		return { ok: false }
	}
}

interface ValidatedRawCall {
	parsed: ParsedToolCall
	valid: ValidatedCall | null
}

const validateCall = (raw: RawToolCall): ValidatedRawCall => {
	const json = parseJson(raw.arguments)
	const input = json.ok ? json.value : raw.arguments
	const reject = (error: string): ValidatedRawCall => ({
		parsed: { name: raw.name, input, status: 'REJECTED', error },
		valid: null,
	})

	if (!isToolName(raw.name)) return reject(`unknown tool "${raw.name}"`)
	if (!json.ok) return reject(`${raw.name}: arguments are not valid JSON`)
	const result = parseInput(raw.name, json.value)
	if (!result.ok) return reject(`${raw.name}: ${formatZodError(result.error)}`)
	return {
		parsed: { name: raw.name, input, status: 'SUCCEEDED', error: null },
		valid: result.call,
	}
}

const checkLogReferences = (
	log: LogFoodInput,
	clarifications: ClarifyInput[],
	{ memoryRefs }: ParseToolCallsOptions,
): string[] => {
	const errors: string[] = []
	log.items.forEach((item, index) => {
		if (item.memoryRef !== null && !memoryRefs.has(item.memoryRef)) {
			errors.push(`log_food: items.${index}.memoryRef "${item.memoryRef}" is not in the context`)
		}
		if (item.source === 'MEMORY' && item.memoryRef === null) {
			errors.push(`log_food: items.${index} has source MEMORY but no memoryRef`)
		}
	})
	for (const clarify of clarifications) {
		const outOfRange = clarify.itemIndexes.filter((index) => index >= log.items.length)
		if (outOfRange.length > 0) {
			errors.push(`clarify: itemIndexes ${outOfRange.join(', ')} are not log_food items`)
		}
	}
	return errors
}

const ONE_DECISION_ERROR =
	'call exactly one of log_food, not_food or reply (clarify only together with log_food)'

type Decision = { decision: FoodParseDecision; errors: [] } | { decision: null; errors: string[] }

const decide = (valid: ValidatedCall[], options: ParseToolCallsOptions): Decision => {
	const logs = valid.flatMap((call) => (call.name === AI_TOOL_NAMES.logFood ? [call.data] : []))
	const clarifications = valid.flatMap((call) =>
		call.name === AI_TOOL_NAMES.clarify ? [call.data] : [],
	)
	const notFood = valid.flatMap((call) => (call.name === AI_TOOL_NAMES.notFood ? [call.data] : []))
	const replies = valid.flatMap((call) => (call.name === AI_TOOL_NAMES.reply ? [call.data] : []))
	const [log] = logs
	const [rejected] = notFood
	const [reply] = replies

	if (logs.length + notFood.length + replies.length !== 1) {
		return { decision: null, errors: [ONE_DECISION_ERROR] }
	}
	if (log) {
		const errors = checkLogReferences(log, clarifications, options)
		if (errors.length > 0) return { decision: null, errors }
		const selected = selectClarifications(log, clarifications)
		return { decision: { kind: 'log', log, clarifications: selected }, errors: [] }
	}
	if (clarifications.length > 0) return { decision: null, errors: [ONE_DECISION_ERROR] }
	if (rejected) return { decision: { kind: 'not_food', reply: rejected.reply }, errors: [] }
	if (reply) return { decision: { kind: 'reply', text: reply.text }, errors: [] }
	return { decision: null, errors: [ONE_DECISION_ERROR] }
}

export const parseToolCalls = (
	rawCalls: RawToolCall[],
	options: ParseToolCallsOptions,
): FoodParseResult => {
	if (rawCalls.length === 0) {
		return { ok: false, errors: ['no tool call — always answer with a tool call'], calls: [] }
	}
	const results = rawCalls.map(validateCall)
	const calls = results.map((result) => result.parsed)
	const callErrors = calls.flatMap((call) => (call.error === null ? [] : [call.error]))
	if (callErrors.length > 0) return { ok: false, errors: callErrors, calls }

	const valid = results.flatMap((result) => (result.valid ? [result.valid] : []))
	const { decision, errors } = decide(valid, options)
	return decision ? { ok: true, decision, calls } : { ok: false, errors, calls }
}
