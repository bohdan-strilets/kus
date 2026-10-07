import { foodCategorySchema, type FoodParseContext } from '@kus/shared'
import { z } from 'zod'

/** `log` = logged without a question; `clarify` = logged and asked; `log_or_clarify` = either is fine. */
export const expectedDecisionSchema = z.enum([
	'log',
	'clarify',
	'log_or_clarify',
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
