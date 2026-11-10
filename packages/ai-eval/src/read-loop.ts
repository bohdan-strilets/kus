// The backend's read round (AiService.parseFood) over the case's own data: the model's find_food
// calls are answered by the same shared functions, from the fixtures of the case.
import {
	type AiCompletion,
	type AiRequestMessage,
	buildReadStepMessages,
	createRefIssuer,
	type EarlierEntryContext,
	FIND_FOOD_INVALID_ARGUMENTS_RESULT,
	FIND_FOOD_TOOL_NAME,
	type FoodParseContext,
	HISTORY_FOOD_REF_PREFIX,
	isReadToolName,
	MAX_PARALLEL_READS,
	type MemoryFoodContext,
	mealTypeSchema,
	parseFindFoodArguments,
	type ParseRefsPatch,
	type RawToolCall,
	READ_CLOSED_ERROR,
	runFindFood,
	SAVED_FOOD_REF_PREFIX,
	splitToolCalls,
} from '@kus/shared'

import { getCaseToday } from './cases/case-builders.js'
import type { EvalCase } from './cases/index.js'
import type { ReadStats } from './eval.types.js'
import { getReadFixtures, toMemoryFoodContext } from './read-fixtures.js'

export interface ReadOutcome {
	/** The tool result the model reads. */
	text: string
	refsPatch: ParseRefsPatch
	/** Context items of the refs this read handed out: their values count when the item is logged. */
	memory: MemoryFoodContext[]
	earlier: EarlierEntryContext[]
}

/** Answers one read call of the case; an unknown read tool is a harness error, as it is in the backend. */
export type ReadExecutor = (call: RawToolCall) => ReadOutcome

/** What the reads of a turn added so far. */
export interface ReadTurn {
	stats: ReadStats
	refsPatch: { memoryRefs: string[]; copyRefs: string[] }
	memory: MemoryFoodContext[]
	earlier: EarlierEntryContext[]
}

export const EMPTY_READ_STATS: ReadStats = { steps: 0, findFoodCalls: 0 }

export const createReadTurn = (): ReadTurn => ({
	stats: { ...EMPTY_READ_STATS },
	refsPatch: { memoryRefs: [], copyRefs: [] },
	memory: [],
	earlier: [],
})

/** The read calls of an answer that run now: at most MAX_PARALLEL_READS, like the backend's. */
export const getReadCalls = (rawCalls: RawToolCall[]): RawToolCall[] =>
	rawCalls.filter((call) => isReadToolName(call.name)).slice(0, MAX_PARALLEL_READS)

const CONTEXT_KEY_PREFIX = 'context:'

export const createReadExecutor = (evalCase: EvalCase, context: FoodParseContext): ReadExecutor => {
	const fixtures = getReadFixtures(evalCase)
	const keyByName = new Map(fixtures.data.saved.map((food) => [food.name, food.key]))
	// the refs the request already carries keep their numbers; new ones continue after them
	const refs = {
		saved: createRefIssuer(
			SAVED_FOOD_REF_PREFIX,
			context.memory.map(
				(food) =>
					[food.ref, keyByName.get(food.name) ?? `${CONTEXT_KEY_PREFIX}${food.ref}`] as const,
			),
		),
		history: createRefIssuer(
			HISTORY_FOOD_REF_PREFIX,
			[...(context.earlier ?? []), ...context.entries].map(
				({ ref }) => [ref, `${CONTEXT_KEY_PREFIX}${ref}`] as const,
			),
		),
	}
	// a fixed clock, so the usage bonus and the recency order do not depend on the day of the run
	const now = new Date(`${getCaseToday(evalCase.context)}T12:00:00Z`)

	return (call) => {
		if (call.name !== FIND_FOOD_TOOL_NAME) throw new Error(`unknown read tool: ${call.name}`)
		const input = parseFindFoodArguments(call.arguments)
		if (input === null) {
			return { text: FIND_FOOD_INVALID_ARGUMENTS_RESULT, refsPatch: {}, memory: [], earlier: [] }
		}
		const result = runFindFood({ input, data: fixtures.data, refs, now })
		const issuedSaved = new Map(refs.saved.getIssued())
		const issuedHistory = new Map(refs.history.getIssued())
		const memory = (result.refsPatch.memoryRefs ?? []).flatMap((ref) => {
			const food = fixtures.savedByKey.get(issuedSaved.get(ref) ?? '')
			return food ? [toMemoryFoodContext(food, ref)] : []
		})
		const earlier = (result.refsPatch.copyRefs ?? []).flatMap((ref) => {
			const entry = fixtures.historyByKey.get(issuedHistory.get(ref) ?? '')
			if (!entry) return []
			const mealType = mealTypeSchema.safeParse(entry.mealType)
			return mealType.success
				? [
						{
							ref,
							date: entry.date,
							mealType: mealType.data,
							name: entry.name,
							grams: entry.grams,
							kcal: entry.kcal,
						},
					]
				: []
		})
		return { text: result.text, refsPatch: result.refsPatch, memory, earlier }
	}
}

/** Runs the read calls of one answer and adds them to the turn; the results by call index. */
export const runReadStep = (
	turn: ReadTurn,
	execute: ReadExecutor,
	calls: RawToolCall[],
): ReadOutcome[] => {
	const outcomes = calls.map(execute)
	turn.stats.steps += 1
	turn.stats.findFoodCalls += calls.filter((call) => call.name === FIND_FOOD_TOOL_NAME).length
	for (const outcome of outcomes) {
		turn.refsPatch.memoryRefs.push(...(outcome.refsPatch.memoryRefs ?? []))
		turn.refsPatch.copyRefs.push(...(outcome.refsPatch.copyRefs ?? []))
		turn.memory.push(...outcome.memory)
		turn.earlier.push(...outcome.earlier)
	}
	return outcomes
}

/** The model's read answer as the next messages: its calls and what the case's data answered. */
export const answerReads = (
	turn: ReadTurn,
	execute: ReadExecutor,
	completion: AiCompletion,
): AiRequestMessage[] => {
	const toolCalls = completion.choices[0]?.message.tool_calls ?? []
	const { reads } = splitToolCalls(toolCalls)
	const outcomes = runReadStep(
		turn,
		execute,
		reads.map(({ function: fn }) => ({ name: fn.name, arguments: fn.arguments })),
	)
	const resultById = new Map(
		reads.flatMap(({ id }, index) => {
			const outcome = outcomes[index]
			return outcome ? [[id, outcome] as const] : []
		}),
	)
	return buildReadStepMessages(completion, toolCalls, resultById)
}

/** A read after the last round: a validation error, the model answers with what it has. */
export const getReadClosedErrors = (rawCalls: RawToolCall[]): string[] =>
	[...new Set(rawCalls.map((call) => call.name).filter(isReadToolName))].map(
		(name) => `${name}: ${READ_CLOSED_ERROR}`,
	)
