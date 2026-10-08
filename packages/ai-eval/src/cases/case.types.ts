import { foodCategorySchema, type FoodParseContext, loggableMealTypeSchema } from '@kus/shared'
import { z } from 'zod'

/**
 * `log` = logged without a question; `clarify` = logged and asked; `log_or_clarify` = either is
 * fine; `edit` = only changed what was logged before (edit tools + reply), nothing new logged.
 */
export const expectedDecisionSchema = z.enum([
	'log',
	'clarify',
	'log_or_clarify',
	'edit',
	'not_food',
	'reply',
])

export type ExpectedDecision = z.infer<typeof expectedDecisionSchema>

/**
 * Exact — labels and weighed plain products; range — home dishes and portions "by eye":
 * inside the range the error is 0, outside it counts to the nearest bound.
 */
export const expectedValueSchema = z.union([
	z.object({ exact: z.number().nonnegative() }),
	z
		.object({ min: z.number().nonnegative(), max: z.number().nonnegative() })
		.refine(({ min, max }) => min <= max, 'min > max'),
])

export type ExpectedValue = z.infer<typeof expectedValueSchema>

const resolutionKindSchema = z.enum(['option', 'values', 'close'])

/** What the edit tools must change — exactly these refs; values of a changed entry as the backend computes them. */
export const expectedEditsSchema = z.object({
	corrected: z
		.array(
			z.object({
				ref: z.string(),
				grams: expectedValueSchema.optional(),
				kcal: expectedValueSchema.optional(),
				/** Lower-case stem the new name must contain ("суп"). */
				nameIncludes: z.string().optional(),
			}),
		)
		.optional(),
	deleted: z.array(z.string()).optional(),
	restored: z.array(z.string()).optional(),
	resolved: z
		.array(
			z.object({
				ref: z.string(),
				/** Any of these is fine: "трішки жирна" may be values between options or the fatter one. */
				kinds: z.array(resolutionKindSchema).min(1),
				optionIndex: z.int().nonnegative().optional(),
				kcal: expectedValueSchema.optional(),
			}),
		)
		.optional(),
})

export type ExpectedEdits = z.infer<typeof expectedEditsSchema>
export type ResolutionKind = z.infer<typeof resolutionKindSchema>

export const evalCaseSchema = z.object({
	id: z.string().min(1),
	text: z.string().min(1),
	expect: z.object({
		decision: expectedDecisionSchema,
		/** Total kcal of everything logged by the message. */
		kcal: expectedValueSchema.optional(),
		protein: expectedValueSchema.optional(),
		/** Each must appear among the logged items' categories (extra items are fine). */
		categories: z.array(foodCategorySchema).optional(),
		/** For reply cases: substrings the answer must contain (e.g. the remaining kcal). */
		replyIncludes: z.array(z.string()).optional(),
		/** Lower-case stems the answer must not contain — claims of a change that didn't happen ("змінив"). */
		replyExcludes: z.array(z.string()).optional(),
		edits: expectedEditsSchema.optional(),
		/** Some kept clarify option renames the item ("Макарони сухі"). */
		clarifyRenames: z.boolean().optional(),
		/** Whole-day cases: an item (name stem) must land in this meal. */
		itemMeals: z
			.array(z.object({ stem: z.string().min(1), mealType: loggableMealTypeSchema }))
			.optional(),
		/** For clarify cases: stems of the items a question is expected about ("печив"). */
		clarifyAbout: z.array(z.string().min(1)).optional(),
	}),
	/** Where the numbers come from (label text, USDA FDC, typical portion). */
	reference: z.string().min(1),
})

/** A saved food (MyFood) in `data/private/*.foods.json`; values per 100 g, like in the DB. */
export const savedFoodSchema = z.object({
	name: z.string().min(1),
	aliases: z.array(z.string()).default([]),
	per100g: z.object({
		kcal: z.number().nonnegative(),
		protein: z.number().nonnegative(),
		fat: z.number().nonnegative(),
		carbs: z.number().nonnegative(),
	}),
	pieceGrams: z.number().positive().nullable().default(null),
	defaultGrams: z.number().positive().nullable().default(null),
	category: foodCategorySchema.catch('plate'),
})

export type SavedFood = z.infer<typeof savedFoodSchema>

export type EvalCase = z.infer<typeof evalCaseSchema> & {
	/** Day state the model sees; defaults to an empty day without a goal. */
	context?: Partial<FoodParseContext>
}
