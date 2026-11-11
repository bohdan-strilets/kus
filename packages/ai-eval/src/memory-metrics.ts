import type { ExpectedFact, ExpectedMemory, ExpectedSavedFood } from './cases/case.types.js'
import type { EvalCase } from './cases/index.js'
import type { CallFacts, CaseResult, LoggedItem } from './eval.types.js'

const GRAMS_TOLERANCE = 0.5
const MEMORY_SOURCE = 'MEMORY'

type SavedFood = CallFacts['savedFoods'][number]
type SavedFact = CallFacts['facts'][number]

const isSameSet = (expected: string[], actual: string[]): boolean =>
	expected.length === actual.length && expected.every((ref) => actual.includes(ref))

const isFoodRight = (want: ExpectedSavedFood, got: SavedFood): boolean =>
	(want.nameIncludes === undefined || got.name.toLowerCase().includes(want.nameIncludes)) &&
	(want.fromItemIndex === undefined || got.fromItemIndex === want.fromItemIndex) &&
	(want.updateRef === undefined || got.updateRef === want.updateRef) &&
	(want.hasPer100g === undefined || (got.per100g !== null) === want.hasPer100g) &&
	(want.pieceGrams === undefined || got.pieceGrams === want.pieceGrams) &&
	(want.defaultGrams === undefined || got.defaultGrams === want.defaultGrams) &&
	(want.category === undefined || got.category === want.category)

/** Each expected food is found once, nothing extra is saved. */
const areFoodsRight = (expected: ExpectedSavedFood[], actual: SavedFood[]): boolean => {
	if (expected.length !== actual.length) return false
	const pool = [...actual]
	return expected.every((want) => {
		const index = pool.findIndex((got) => isFoodRight(want, got))
		if (index === -1) return false
		pool.splice(index, 1)
		return true
	})
}

const isFactRight = (want: ExpectedFact, got: SavedFact): boolean => {
	const text = got.text.toLowerCase()
	return (
		(want.explicit === undefined || got.explicit === want.explicit) &&
		(want.category === undefined || got.category === want.category) &&
		(want.textIncludesAny === undefined ||
			want.textIncludesAny.some((part) => text.includes(part))) &&
		(want.textExcludes ?? []).every((part) => !text.includes(part))
	)
}

/** null = no save_fact at all; an optional fact may be missing, but a saved one must match. */
const areFactsRight = (expected: ExpectedFact | null, actual: SavedFact[]): boolean => {
	if (expected === null) return actual.length === 0
	if (actual.length === 0) return expected.isOptional === true
	const [only] = actual
	return actual.length === 1 && only !== undefined && isFactRight(expected, only)
}

/** A forget_food call as one comparable word: the ref and whether the user had agreed. */
const toRemovalKey = ({ ref, confirmed }: { ref: string; confirmed: boolean }): string =>
	`${ref}:${confirmed ? 'yes' : 'ask'}`

/** The memory calls (save_food, save_fact, forget_fact, forget_food, restore_food) are exactly what the case expects; unset parts are not judged. */
export const isMemoryCorrect = (expected: ExpectedMemory, calls: CallFacts): boolean =>
	(expected.foods === undefined || areFoodsRight(expected.foods, calls.savedFoods)) &&
	(expected.fact === undefined || areFactsRight(expected.fact, calls.facts)) &&
	(expected.forgets === undefined ||
		isSameSet(
			expected.forgets,
			calls.forgets.map(({ ref }) => ref),
		)) &&
	(expected.foodRemovals === undefined ||
		isSameSet(
			expected.foodRemovals.map(toRemovalKey),
			(calls.foodRemovals ?? []).map(toRemovalKey),
		)) &&
	(expected.noConfirmedRemoval === undefined ||
		(calls.foodRemovals ?? []).every(({ confirmed }) => !confirmed)) &&
	(expected.foodRestores === undefined ||
		isSameSet(
			expected.foodRestores,
			(calls.foodRestores ?? []).map(({ ref }) => ref),
		))

/** Every expected saved-food item is logged from it (source MEMORY, its ref) with exactly these grams. */
export const areMemoryItemsCorrect = (
	expected: { ref: string; grams: number }[],
	items: LoggedItem[],
): boolean =>
	expected.every((want) =>
		items.some(
			(item) =>
				item.source === MEMORY_SOURCE &&
				item.memoryRef === want.ref &&
				Math.abs(item.grams - want.grams) <= GRAMS_TOLERANCE,
		),
	)

/** find_food was called (true) or was not (false), by the number of calls the read rounds answered. */
export const isFindFoodRight = (expected: boolean, result: CaseResult): boolean =>
	(result.reads?.findFoodCalls ?? 0) > 0 === expected

/**
 * get_workouts was called or not, and every call asked what the user meant: a period of the right
 * length, ending today, about the named exercise.
 */
export const isGetWorkoutsRight = (
	expected: NonNullable<EvalCase['expect']['getWorkouts']>,
	result: CaseResult,
): boolean => {
	const calls = result.reads?.getWorkouts ?? []
	if (calls.length > 0 !== expected.called) return false
	const { days, endDateNull, exerciseStem } = expected
	return calls.every(
		(call) =>
			(days === undefined || (call.days >= days.min && call.days <= days.max)) &&
			(endDateNull === undefined || (call.endDate === null) === endDateNull) &&
			(exerciseStem === undefined ||
				(call.exercise?.toLowerCase().includes(exerciseStem) ?? false)),
	)
}

/** Exactly these saved-food refs are used by the logged items (each ref counted once). */
export const areMemoryRefsRight = (expected: string[], items: LoggedItem[]): boolean =>
	isSameSet(
		[...new Set(expected)],
		[...new Set(items.flatMap((item) => (item.memoryRef === null ? [] : [item.memoryRef])))],
	)

export const hasMemoryExpectations = ({ expect }: EvalCase): boolean =>
	expect.memory !== undefined ||
	expect.memoryItems !== undefined ||
	expect.findFoodCalled !== undefined ||
	expect.getWorkouts !== undefined ||
	expect.memoryRefs !== undefined

export const isCaseMemoryCorrect = (evalCase: EvalCase, result: CaseResult): boolean => {
	const { memory, memoryItems, findFoodCalled, getWorkouts, memoryRefs } = evalCase.expect
	return (
		(memory === undefined || isMemoryCorrect(memory, result.calls)) &&
		(memoryItems === undefined || areMemoryItemsCorrect(memoryItems, result.items)) &&
		(findFoodCalled === undefined || isFindFoodRight(findFoodCalled, result)) &&
		(getWorkouts === undefined || isGetWorkoutsRight(getWorkouts, result)) &&
		(memoryRefs === undefined || areMemoryRefsRight(memoryRefs, result.items))
	)
}
