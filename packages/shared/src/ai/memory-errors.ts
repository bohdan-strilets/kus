// What the parser rejects in the memory tools. Shared, so the backend and the eval judge the same
// way; the model gets the text on the retry. The fact guard is not here: it never fails a turn.
import type { ParseRefs } from './entry-edits.js'
import { normalizeFoodName } from './normalize-food-name.js'
import { normalizeName } from './memory-match.js'
import {
	MAX_FOOD_REMOVALS_PER_MESSAGE,
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

const getFoodRemovalErrors = (
	memory: MemoryActions,
	log: LogFoodInput | null,
	refs: ParseRefs,
): string[] => {
	const { foodRemovals } = memory
	if (foodRemovals.length === 0) return []
	const errors: string[] = []
	if (foodRemovals.length > MAX_FOOD_REMOVALS_PER_MESSAGE) {
		errors.push(`forget_food: at most ${MAX_FOOD_REMOVALS_PER_MESSAGE} per message`)
	}
	if (new Set(foodRemovals.map(({ confirmed }) => confirmed)).size > 1) {
		errors.push('forget_food: all calls of one answer have the same confirmed')
	}
	if (new Set(foodRemovals.map(({ ref }) => ref)).size < foodRemovals.length) {
		errors.push('forget_food: each ref once')
	}
	if (foodRemovals.some(({ confirmed }) => !confirmed) && log) {
		errors.push('forget_food with confirmed false asks in reply — not together with log_food')
	}
	const usedRefs = new Set([
		...memory.foods.flatMap(({ updateRef }) => updateRef ?? []),
		...(log?.items.flatMap(({ memoryRef }) => memoryRef ?? []) ?? []),
	])
	for (const { ref, confirmed } of foodRemovals) {
		const isPending = refs.pendingRemovalRefs?.has(ref) === true
		if (!isPending && !refs.memoryRefs.has(ref)) {
			errors.push(`forget_food: ${ref} is not in "Saved foods" or "Foods to remove"`)
		} else if (confirmed && !isPending) {
			errors.push(
				`forget_food: ${ref} is not in "Foods to remove" — ask first with confirmed false`,
			)
		}
		if (usedRefs.has(ref)) {
			errors.push(`forget_food: ${ref} is also saved or logged in this answer — choose one`)
		}
	}
	return errors
}

const getFoodRestoreErrors = (memory: MemoryActions, refs: ParseRefs): string[] => {
	const { foodRestores } = memory
	const errors: string[] = []
	if (foodRestores.length > MAX_FOOD_REMOVALS_PER_MESSAGE) {
		errors.push(`restore_food: at most ${MAX_FOOD_REMOVALS_PER_MESSAGE} per message`)
	}
	if (new Set(foodRestores.map(({ ref }) => ref)).size < foodRestores.length) {
		errors.push('restore_food: each ref once')
	}
	for (const { ref } of foodRestores) {
		if (!refs.forgottenFoodRefs?.has(ref)) {
			errors.push(`restore_food: ${ref} is not in "Foods forgotten today"`)
		}
	}
	return errors
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
	errors.push(...getFoodRemovalErrors(memory, log, refs), ...getFoodRestoreErrors(memory, refs))
	return errors
}
