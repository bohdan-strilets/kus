import type { EntryWasContext } from '@kus/shared'

import { MealType } from '../../generated/prisma/enums'

/** A stored Correction: only the fields that changed, as the entry held them before. */
export interface StoredCorrection {
	foodEntryId: string
	before: unknown
}

type Values = Omit<EntryWasContext, 'originally'>

const NUMERIC_FIELDS = ['grams', 'kcal', 'protein', 'fat', 'carbs'] as const

const MEAL_TYPES: readonly string[] = Object.values(MealType)

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

/** The stored `before` values the model may see, each field only if it has the right type. */
const readValues = (before: Record<string, unknown>): Values => {
	const values: Values = {}
	if (typeof before.name === 'string') values.name = before.name
	if (typeof before.mealType === 'string' && MEAL_TYPES.includes(before.mealType)) {
		values.mealType = before.mealType as MealType
	}
	for (const field of NUMERIC_FIELDS) {
		const value = before[field]
		if (typeof value === 'number') values[field] = value
	}
	return values
}

/**
 * What each edited entry held before its changes. Per field, `was` is the value before the latest
 * change; a field changed more than once also carries the very first value in `originally`.
 * Corrections must come oldest first. A delete or restore carries no values and is skipped.
 */
export const toValuesBefore = (
	corrections: readonly StoredCorrection[],
): Map<string, EntryWasContext> => {
	const result = new Map<string, EntryWasContext>()
	const firsts = new Map<string, Values>()
	for (const { foodEntryId, before } of corrections) {
		if (!isRecord(before)) continue
		const values = readValues(before)
		if (Object.keys(values).length === 0) continue

		const first = firsts.get(foodEntryId) ?? {}
		const was: EntryWasContext = { ...result.get(foodEntryId), ...values }
		const originally: Values = { ...was.originally }
		for (const key of Object.keys(values) as (keyof Values)[]) {
			if (first[key] === undefined) Object.assign(first, { [key]: values[key] })
			else if (first[key] !== values[key]) Object.assign(originally, { [key]: first[key] })
		}
		firsts.set(foodEntryId, first)
		result.set(foodEntryId, Object.keys(originally).length > 0 ? { ...was, originally } : was)
	}
	return result
}
