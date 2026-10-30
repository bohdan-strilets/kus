// What the parser rejects in the memory tools. Shared, so the backend and the eval judge the same
// way; the model gets the text on the retry. The fact guard is not here: it never fails a turn.
import type { ParseRefs } from './entry-edits.js'
import { normalizeFoodName } from './normalize-food-name.js'
import { normalizeName } from './memory-match.js'
import {
	MAX_FORGOTTEN_FACTS_PER_MESSAGE,
	MAX_SAVED_FOODS_PER_MESSAGE,
	type MemoryActions,
	type SaveFoodInput,
} from './memory-tools.js'
import type { LogFoodInput } from './tools.js'

/** The key saved foods are matched by: lowercase, single spaces, no Latin look-alikes. */
export const toFoodNameKey = (name: string): string => normalizeName(normalizeFoodName(name))

const getSaveFoodValueErrors = (
	food: SaveFoodInput,
	index: number,
	log: LogFoodInput | null,
): string[] => {
	const prefix = `save_food: foods.${index}`
	if (food.fromItemIndex !== null) {
		if (food.per100g !== null || food.category !== null) {
			return [`${prefix} has fromItemIndex — leave per100g and category null`]
		}
		if (!log) return [`${prefix} has fromItemIndex but this answer has no log_food`]
		if (food.fromItemIndex >= log.items.length) {
			return [`${prefix} fromItemIndex ${food.fromItemIndex} is not a log_food item`]
		}
		return []
	}
	if (food.per100g === null || food.category === null) {
		return [`${prefix} needs per100g and category, or fromItemIndex of a log_food item`]
	}
	return []
}

const getSaveFoodRefErrors = (food: SaveFoodInput, index: number, refs: ParseRefs): string[] => {
	const prefix = `save_food: foods.${index}`
	if (food.updateRef !== null) {
		return refs.memoryRefs.has(food.updateRef)
			? []
			: [`${prefix} updateRef "${food.updateRef}" is not in "Saved foods"`]
	}
	const savedRef = refs.memoryRefByName?.get(toFoodNameKey(food.name))
	if (savedRef === undefined) return []
	return [
		`${prefix} "${food.name}" is already saved as ${savedRef} — ask the user in the reply whether to update it, or set updateRef`,
	]
}

export const getMemoryErrors = (
	memory: MemoryActions,
	log: LogFoodInput | null,
	refs: ParseRefs,
): string[] => {
	const errors: string[] = []
	if (memory.foods.length > MAX_SAVED_FOODS_PER_MESSAGE) {
		errors.push(`save_food: at most ${MAX_SAVED_FOODS_PER_MESSAGE} per message`)
	}
	if (memory.forgets.length > MAX_FORGOTTEN_FACTS_PER_MESSAGE) {
		errors.push(`forget_fact: at most ${MAX_FORGOTTEN_FACTS_PER_MESSAGE} per message`)
	}
	memory.foods.forEach((food, index) => {
		errors.push(
			...getSaveFoodValueErrors(food, index, log),
			...getSaveFoodRefErrors(food, index, refs),
		)
	})
	for (const { ref } of memory.forgets) {
		if (!refs.factRefs?.has(ref)) errors.push(`forget_fact: ${ref} is not in "User facts"`)
	}
	return errors
}
