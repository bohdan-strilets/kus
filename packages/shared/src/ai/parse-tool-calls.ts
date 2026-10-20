// Validates what the model returned. Shared by the backend and the eval, so both judge the same way.
import type { z } from 'zod'

import type { ToolCallStatus } from '../schemas/enums.js'
import {
	AI_TOOL_NAMES,
	AI_TOOL_SCHEMAS,
	type AiToolName,
	type ClarifyInput,
	clarifyInputSchema,
	type CloseDayInput,
	closeDayInputSchema,
	type DeleteMeasurementInput,
	deleteMeasurementInputSchema,
	type LogFoodInput,
	type LogMeasurementInput,
	logMeasurementInputSchema,
	logFoodInputSchema,
	type NotFoodInput,
	notFoodInputSchema,
	type PhotoUnusableInput,
	type PhotoUnusableReason,
	photoUnusableInputSchema,
	type ReplyInput,
	replyInputSchema,
	type ShowDayInput,
	showDayInputSchema,
	type ShowStatsInput,
	showStatsInputSchema,
} from './tools.js'
import {
	getCloseDayErrors,
	getFoodDateErrors,
	getShowDayErrors,
	getShowStatsErrors,
} from './date-errors.js'
import {
	type ClarificationResult,
	filterClarifications,
	getClarifyOptionErrors,
} from './clarifications.js'
import {
	type CorrectEntryInput,
	correctEntryInputSchema,
	type DeleteEntryInput,
	deleteEntryInputSchema,
	type EntryEdits,
	hasEdits,
	type ResolveClarificationInput,
	resolveClarificationInputSchema,
	type RestoreEntryInput,
	restoreEntryInputSchema,
} from './edit-tools.js'
import { getEditErrors, type ParseRefs } from './entry-edits.js'
import {
	getMeasurementDay,
	getMeasurementDayKey,
	getMeasurementDeletionErrors,
	getMeasurementErrors,
	roundMeasurementValue,
} from './measurements.js'
import { normalizeFoodName } from './normalize-food-name.js'

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

/**
 * `log` may also change earlier entries; `edit` only changes them and answers with `text`.
 * Weight and waist (logged or deleted) ride along with `log` and `reply`; `day` shows the card of a day,
 * `close_day` the same card as the day's close (it may first log the gap up to the user's own total),
 * `stats` the card of a week or a month.
 */
export type FoodParseDecision =
	| {
			kind: 'log'
			log: LogFoodInput
			clarifications: ClarificationResult[]
			edits: EntryEdits
			measurements: LogMeasurementInput[]
			measurementDeletions: DeleteMeasurementInput[]
	  }
	| { kind: 'edit'; edits: EntryEdits; text: string }
	| { kind: 'not_food'; reply: string }
	| { kind: 'photo_unusable'; reason: PhotoUnusableReason; reply: string }
	| {
			kind: 'reply'
			text: string
			measurements: LogMeasurementInput[]
			measurementDeletions: DeleteMeasurementInput[]
	  }
	/** `date` null = today. */
	| { kind: 'day'; date: string | null; text: string }
	| { kind: 'close_day'; date: string | null; estimatedTotalKcal: number | null; text: string }
	| { kind: 'stats'; period: ShowStatsInput['period']; endDate: string | null; text: string }

export type FoodParseResult =
	| { ok: true; decision: FoodParseDecision; calls: ParsedToolCall[] }
	| { ok: false; errors: string[]; calls: ParsedToolCall[] }

/** Refs given to the model in this request (see getParseRefs). */
export type ParseToolCallsOptions = ParseRefs

export interface ParseMessageOptions {
	/** The message carried a photo: only then may the model answer with photo_unusable. */
	hasImage?: boolean
}

type ValidatedCall =
	| { name: typeof AI_TOOL_NAMES.logFood; data: LogFoodInput }
	| { name: typeof AI_TOOL_NAMES.logMeasurement; data: LogMeasurementInput }
	| { name: typeof AI_TOOL_NAMES.deleteMeasurement; data: DeleteMeasurementInput }
	| { name: typeof AI_TOOL_NAMES.showDay; data: ShowDayInput }
	| { name: typeof AI_TOOL_NAMES.closeDay; data: CloseDayInput }
	| { name: typeof AI_TOOL_NAMES.showStats; data: ShowStatsInput }
	| { name: typeof AI_TOOL_NAMES.clarify; data: ClarifyInput }
	| { name: typeof AI_TOOL_NAMES.correctEntry; data: CorrectEntryInput }
	| { name: typeof AI_TOOL_NAMES.deleteEntry; data: DeleteEntryInput }
	| { name: typeof AI_TOOL_NAMES.restoreEntry; data: RestoreEntryInput }
	| { name: typeof AI_TOOL_NAMES.resolveClarification; data: ResolveClarificationInput }
	| { name: typeof AI_TOOL_NAMES.notFood; data: NotFoodInput }
	| { name: typeof AI_TOOL_NAMES.photoUnusable; data: PhotoUnusableInput }
	| { name: typeof AI_TOOL_NAMES.reply; data: ReplyInput }

type InputParse = { ok: true; call: ValidatedCall } | { ok: false; error: z.ZodError }

const isToolName = (name: string): name is AiToolName => Object.hasOwn(AI_TOOL_SCHEMAS, name)

const toInputParse = <T>(
	result: z.ZodSafeParseResult<T>,
	toCall: (data: T) => ValidatedCall,
): InputParse =>
	result.success ? { ok: true, call: toCall(result.data) } : { ok: false, error: result.error }

const parseInput = (name: AiToolName, value: unknown): InputParse => {
	switch (name) {
		case AI_TOOL_NAMES.logFood:
			return toInputParse(logFoodInputSchema.safeParse(value), (data) => ({ name, data }))
		case AI_TOOL_NAMES.logMeasurement:
			return toInputParse(logMeasurementInputSchema.safeParse(value), (data) => ({ name, data }))
		case AI_TOOL_NAMES.deleteMeasurement:
			return toInputParse(deleteMeasurementInputSchema.safeParse(value), (data) => ({
				name,
				data,
			}))
		case AI_TOOL_NAMES.showDay:
			return toInputParse(showDayInputSchema.safeParse(value), (data) => ({ name, data }))
		case AI_TOOL_NAMES.closeDay:
			return toInputParse(closeDayInputSchema.safeParse(value), (data) => ({ name, data }))
		case AI_TOOL_NAMES.showStats:
			return toInputParse(showStatsInputSchema.safeParse(value), (data) => ({ name, data }))
		case AI_TOOL_NAMES.clarify:
			return toInputParse(clarifyInputSchema.safeParse(value), (data) => ({ name, data }))
		case AI_TOOL_NAMES.correctEntry:
			return toInputParse(correctEntryInputSchema.safeParse(value), (data) => ({ name, data }))
		case AI_TOOL_NAMES.deleteEntry:
			return toInputParse(deleteEntryInputSchema.safeParse(value), (data) => ({ name, data }))
		case AI_TOOL_NAMES.restoreEntry:
			return toInputParse(restoreEntryInputSchema.safeParse(value), (data) => ({ name, data }))
		case AI_TOOL_NAMES.resolveClarification:
			return toInputParse(resolveClarificationInputSchema.safeParse(value), (data) => ({
				name,
				data,
			}))
		case AI_TOOL_NAMES.notFood:
			return toInputParse(notFoodInputSchema.safeParse(value), (data) => ({ name, data }))
		case AI_TOOL_NAMES.photoUnusable:
			return toInputParse(photoUnusableInputSchema.safeParse(value), (data) => ({ name, data }))
		case AI_TOOL_NAMES.reply:
			return toInputParse(replyInputSchema.safeParse(value), (data) => ({ name, data }))
	}
}

/** Fixes Latin look-alikes in the food names the model wrote, before anything compares or saves them. */
const normalizeCallNames = (call: ValidatedCall): ValidatedCall => {
	switch (call.name) {
		case AI_TOOL_NAMES.logFood:
			return {
				...call,
				data: {
					...call.data,
					items: call.data.items.map((item) => ({ ...item, name: normalizeFoodName(item.name) })),
				},
			}
		case AI_TOOL_NAMES.clarify:
			return {
				...call,
				data: {
					...call.data,
					options: call.data.options.map((option) => ({
						...option,
						name: option.name === null ? null : normalizeFoodName(option.name),
					})),
				},
			}
		case AI_TOOL_NAMES.correctEntry:
			return {
				...call,
				data: {
					...call.data,
					changes: call.data.changes.map((change) => ({
						...change,
						name: change.name === null ? null : normalizeFoodName(change.name),
					})),
				},
			}
		default:
			return call
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
		valid: normalizeCallNames(result.call),
	}
}

const EMPTY_REFS: ReadonlySet<string> = new Set()

const checkLogReferences = (
	log: LogFoodInput,
	clarifications: ClarifyInput[],
	{ memoryRefs, copyRefs = EMPTY_REFS }: ParseRefs,
): string[] => {
	const errors: string[] = []
	log.items.forEach((item, index) => {
		if (item.memoryRef !== null && !memoryRefs.has(item.memoryRef)) {
			errors.push(`log_food: items.${index}.memoryRef "${item.memoryRef}" is not in the context`)
		}
		if (item.copyRef !== null && !copyRefs.has(item.copyRef)) {
			errors.push(`log_food: items.${index}.copyRef "${item.copyRef}" is not in "Earlier entries"`)
		}
		if (item.copyRef !== null && item.memoryRef !== null) {
			errors.push(`log_food: items.${index} has both copyRef and memoryRef — use one`)
		}
		if (item.source === 'MEMORY' && item.memoryRef === null) {
			errors.push(`log_food: items.${index} has source MEMORY but no memoryRef`)
		}
		// the backend rescales a memoryRef item from the saved food, which would silently drop an
		// estimate the model corrected for the user's words ("без гущі")
		if (item.source !== 'MEMORY' && item.memoryRef !== null) {
			errors.push(
				`log_food: items.${index} has memoryRef but source ${item.source} — set memoryRef only for unchanged saved foods (source MEMORY)`,
			)
		}
	})
	for (const clarify of clarifications) {
		const outOfRange = clarify.itemIndexes.filter((index) => index >= log.items.length)
		if (outOfRange.length > 0) {
			errors.push(`clarify: itemIndexes ${outOfRange.join(', ')} are not log_food items`)
			continue
		}
		errors.push(...getClarifyOptionErrors(log, clarify))
	}
	return errors
}

const ONE_DECISION_ERROR =
	'call log_food (with clarify and edit tools if needed), or edit tools (correct_entry, delete_entry, restore_entry, resolve_clarification) with exactly one reply, or exactly one of not_food, photo_unusable, show_day, close_day, show_stats or reply'
const SHOW_DAY_ALONE_ERROR =
	'show_day is the whole answer — not with log_food, reply, clarify, measurement or edit tools'
const CARD_ALONE_ERROR =
	'close_day and show_stats are the whole answer — not with log_food, reply, clarify, measurement or edit tools'
const NO_PHOTO_ERROR =
	'photo_unusable: this message has no photo — answer with reply (or not_food) instead'

const MEASUREMENT_WITH_ANSWER_ERROR =
	'log_measurement goes together with exactly one log_food or reply — not with not_food, photo_unusable or edit tools'

const MEASUREMENT_DELETION_WITH_ANSWER_ERROR =
	'delete_measurement goes together with exactly one log_food or reply — not with not_food, photo_unusable, show_day or edit tools'

/** A value is either logged or deleted in a turn, never both. */
const getMeasurementOverlapErrors = (
	measurements: readonly LogMeasurementInput[],
	deletions: readonly DeleteMeasurementInput[],
	today: string,
): string[] => {
	const logged = new Set(
		measurements.map((input) => getMeasurementDayKey(input.kind, getMeasurementDay(input, today))),
	)
	return deletions.flatMap(({ kind, date }) =>
		logged.has(getMeasurementDayKey(kind, date))
			? [
					`delete_measurement: ${kind} ${date} is also logged in this message — one change per value`,
				]
			: [],
	)
}

type Decision = { decision: FoodParseDecision; errors: [] } | { decision: null; errors: string[] }

const collectEdits = (valid: ValidatedCall[]): EntryEdits => ({
	corrections: valid.flatMap((call) =>
		call.name === AI_TOOL_NAMES.correctEntry ? call.data.changes : [],
	),
	deletions: valid.flatMap((call) =>
		call.name === AI_TOOL_NAMES.deleteEntry ? call.data.refs : [],
	),
	restorations: valid.flatMap((call) =>
		call.name === AI_TOOL_NAMES.restoreEntry ? call.data.refs : [],
	),
	resolutions: valid.flatMap((call) =>
		call.name === AI_TOOL_NAMES.resolveClarification ? [call.data] : [],
	),
})

const decide = (
	valid: ValidatedCall[],
	refs: ParseRefs,
	{ hasImage = false }: ParseMessageOptions,
): Decision => {
	const logs = valid.flatMap((call) => (call.name === AI_TOOL_NAMES.logFood ? [call.data] : []))
	const clarifications = valid.flatMap((call) =>
		call.name === AI_TOOL_NAMES.clarify ? [call.data] : [],
	)
	const notFood = valid.flatMap((call) => (call.name === AI_TOOL_NAMES.notFood ? [call.data] : []))
	const unusable = valid.flatMap((call) =>
		call.name === AI_TOOL_NAMES.photoUnusable ? [call.data] : [],
	)
	const replies = valid.flatMap((call) => (call.name === AI_TOOL_NAMES.reply ? [call.data] : []))
	const measurements = valid.flatMap((call) =>
		call.name === AI_TOOL_NAMES.logMeasurement
			? [{ ...call.data, value: roundMeasurementValue(call.data.value) }]
			: [],
	)
	const deletions = valid.flatMap((call) =>
		call.name === AI_TOOL_NAMES.deleteMeasurement ? [call.data] : [],
	)
	const shows = valid.flatMap((call) => (call.name === AI_TOOL_NAMES.showDay ? [call.data] : []))
	const closes = valid.flatMap((call) => (call.name === AI_TOOL_NAMES.closeDay ? [call.data] : []))
	const stats = valid.flatMap((call) => (call.name === AI_TOOL_NAMES.showStats ? [call.data] : []))
	const edits = collectEdits(valid)
	const isEditing = hasEdits(edits)
	const [log] = logs
	const [rejected] = notFood
	const [photoUnusable] = unusable
	const [reply] = replies
	const [show] = shows
	const [close] = closes
	const [statsCall] = stats

	// log_food speaks for the whole turn, an edit-only turn speaks through reply
	const answers =
		logs.length +
		notFood.length +
		unusable.length +
		replies.length +
		shows.length +
		closes.length +
		stats.length
	if (answers !== 1 || ((rejected || photoUnusable) && isEditing))
		return { decision: null, errors: [ONE_DECISION_ERROR] }
	if (show) {
		const isAlone = !isEditing && measurements.length === 0 && deletions.length === 0
		if (!isAlone || clarifications.length > 0)
			return { decision: null, errors: [SHOW_DAY_ALONE_ERROR] }
		const errors = getShowDayErrors(show.date, refs.today)
		if (errors.length > 0) return { decision: null, errors }
		return { decision: { kind: 'day', date: show.date, text: show.reply }, errors: [] }
	}
	if (close || statsCall) {
		const isAlone = !isEditing && measurements.length === 0 && deletions.length === 0
		if (!isAlone || clarifications.length > 0) return { decision: null, errors: [CARD_ALONE_ERROR] }
		if (close) {
			const errors = getCloseDayErrors(close.date, refs.today)
			if (errors.length > 0) return { decision: null, errors }
			return {
				decision: {
					kind: 'close_day',
					date: close.date,
					estimatedTotalKcal: close.estimatedTotalKcal,
					text: close.reply,
				},
				errors: [],
			}
		}
		if (!statsCall) return { decision: null, errors: [ONE_DECISION_ERROR] }
		const errors = getShowStatsErrors(statsCall.endDate, refs.today)
		if (errors.length > 0) return { decision: null, errors }
		return {
			decision: {
				kind: 'stats',
				period: statsCall.period,
				endDate: statsCall.endDate,
				text: statsCall.reply,
			},
			errors: [],
		}
	}
	if (photoUnusable && !hasImage) return { decision: null, errors: [NO_PHOTO_ERROR] }
	const hasMeasurements = measurements.length > 0
	if (hasMeasurements && (rejected || photoUnusable || (reply && isEditing))) {
		return { decision: null, errors: [MEASUREMENT_WITH_ANSWER_ERROR] }
	}
	if (deletions.length > 0 && (rejected || photoUnusable || (reply && isEditing))) {
		return { decision: null, errors: [MEASUREMENT_DELETION_WITH_ANSWER_ERROR] }
	}
	const measurementErrors = [
		...getMeasurementErrors(measurements, refs),
		...getMeasurementDeletionErrors(deletions, refs),
		...getMeasurementOverlapErrors(measurements, deletions, refs.today),
	]
	if (log) {
		const errors = [
			...checkLogReferences(log, clarifications, refs),
			...getFoodDateErrors(log, refs.today),
			...getEditErrors(edits, refs),
			...measurementErrors,
		]
		if (errors.length > 0) return { decision: null, errors }
		const selected = filterClarifications(log, clarifications)
		return {
			decision: {
				kind: 'log',
				log,
				clarifications: selected,
				edits,
				measurements,
				measurementDeletions: deletions,
			},
			errors: [],
		}
	}
	if (clarifications.length > 0) return { decision: null, errors: [ONE_DECISION_ERROR] }
	if (rejected) return { decision: { kind: 'not_food', reply: rejected.reply }, errors: [] }
	if (photoUnusable) {
		return {
			decision: {
				kind: 'photo_unusable',
				reason: photoUnusable.reason,
				reply: photoUnusable.reply,
			},
			errors: [],
		}
	}
	if (!reply) return { decision: null, errors: [ONE_DECISION_ERROR] }
	if (!isEditing) {
		if (measurementErrors.length > 0) return { decision: null, errors: measurementErrors }
		return {
			decision: {
				kind: 'reply',
				text: reply.text,
				measurements,
				measurementDeletions: deletions,
			},
			errors: [],
		}
	}
	const errors = getEditErrors(edits, refs)
	if (errors.length > 0) return { decision: null, errors }
	return { decision: { kind: 'edit', edits, text: reply.text }, errors: [] }
}

export const parseToolCalls = (
	rawCalls: RawToolCall[],
	refs: ParseRefs,
	message: ParseMessageOptions = {},
): FoodParseResult => {
	if (rawCalls.length === 0) {
		return { ok: false, errors: ['no tool call — always answer with a tool call'], calls: [] }
	}
	const results = rawCalls.map(validateCall)
	const calls = results.map((result) => result.parsed)
	const callErrors = calls.flatMap((call) => (call.error === null ? [] : [call.error]))
	if (callErrors.length > 0) return { ok: false, errors: callErrors, calls }

	const valid = results.flatMap((result) => (result.valid ? [result.valid] : []))
	const { decision, errors } = decide(valid, refs, message)
	return decision ? { ok: true, decision, calls } : { ok: false, errors, calls }
}
