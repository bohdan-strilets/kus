import { z } from 'zod'

import { foodCategorySchema, myFoodSourceSchema } from './enums.js'
import { MAX_ENTRY_GRAMS, MAX_KCAL_PER_GRAM, MIN_ENTRY_GRAMS } from './food-entry.js'

const GRAMS_PER_100 = 100
export const MY_FOOD_NAME_MAX_LENGTH = 200
/** «Що запам'ятати?» takes the entries of one meal card; more is never on screen at once. */
export const REMEMBER_ENTRIES_MAX = 20
/** A whole list fits one page: the screen searches only past 15 foods, and 500 is the scan bound. */
export const MY_FOODS_PAGE_LIMIT_MAX = 500
export const MY_FOODS_PAGE_LIMIT_DEFAULT = 500
export const MY_FOODS_SEARCH_MAX_LENGTH = 100

const gramsSchema = z.number().min(MIN_ENTRY_GRAMS).max(MAX_ENTRY_GRAMS)

/**
 * Values per 100 g as the user typed them or the label says. No kcal ↔ macros check: label values
 * round each figure separately, and the edit sheet has no place to explain a mismatch.
 */
export const myFoodPer100gSchema = z
	.object({
		kcal: z.number().nonnegative(),
		protein: z.number().nonnegative(),
		fat: z.number().nonnegative(),
		carbs: z.number().nonnegative(),
		fiber: z.number().nonnegative().nullable().default(null),
	})
	.superRefine((values, context) => {
		if (values.kcal > MAX_KCAL_PER_GRAM * GRAMS_PER_100) {
			context.addIssue({ code: 'custom', path: ['kcal'], message: 'KCAL_DENSITY_TOO_HIGH' })
		}
		const grams = values.protein + values.fat + values.carbs + (values.fiber ?? 0)
		if (grams > GRAMS_PER_100) {
			context.addIssue({ code: 'custom', path: ['protein'], message: 'MACROS_OVER_100G' })
		}
	})

export type MyFoodPer100g = z.infer<typeof myFoodPer100gSchema>

/** One saved food as «Пам'ять · Продукти» shows it. */
export const myFoodResponseSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	brand: z.string().nullable(),
	aliases: z.array(z.string()),
	per100g: z.object({
		kcal: z.number(),
		protein: z.number(),
		fat: z.number(),
		carbs: z.number(),
		fiber: z.number().nullable(),
	}),
	/** «1 шт = 15 г». */
	pieceGrams: z.number().nullable(),
	/** «Звична порція»: what the chat logs when the amount is not said. */
	defaultGrams: z.number().nullable(),
	category: foodCategorySchema,
	source: myFoodSourceSchema,
	updatedAt: z.iso.datetime(),
})

export type MyFoodResponse = z.infer<typeof myFoodResponseSchema>

/** `:id` of /my-foods/:id routes. */
export const myFoodParamsSchema = z.object({ id: z.uuid() })

export type MyFoodParams = z.infer<typeof myFoodParamsSchema>

/** Query of GET /my-foods: sorted by name; `q` matches the name and aliases. */
export const myFoodsQuerySchema = z.object({
	q: z.string().trim().max(MY_FOODS_SEARCH_MAX_LENGTH).optional(),
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce
		.number()
		.int()
		.positive()
		.max(MY_FOODS_PAGE_LIMIT_MAX)
		.default(MY_FOODS_PAGE_LIMIT_DEFAULT),
})

export type MyFoodsQuery = z.infer<typeof myFoodsQuerySchema>

/** Body of PATCH /my-foods/:id — the fields of the product sheet; null clears an optional one. */
export const updateMyFoodRequestSchema = z
	.object({
		name: z.string().trim().min(1).max(MY_FOOD_NAME_MAX_LENGTH).optional(),
		per100g: myFoodPer100gSchema.optional(),
		pieceGrams: gramsSchema.nullable().optional(),
		defaultGrams: gramsSchema.nullable().optional(),
	})
	.refine(
		(body) =>
			body.name !== undefined ||
			body.per100g !== undefined ||
			body.pieceGrams !== undefined ||
			body.defaultGrams !== undefined,
		{ message: 'NOTHING_TO_CHANGE' },
	)

export type UpdateMyFoodRequest = z.infer<typeof updateMyFoodRequestSchema>

/** Body of POST /my-foods/from-entries — the «Запам'ятати» button and the «Що запам'ятати?» sheet. */
export const rememberEntriesRequestSchema = z.object({
	entryIds: z
		.array(z.uuid())
		.min(1)
		.max(REMEMBER_ENTRIES_MAX)
		.refine((ids) => new Set(ids).size === ids.length, { message: 'DUPLICATE_IDS' }),
})

export type RememberEntriesRequest = z.infer<typeof rememberEntriesRequestSchema>

/** An entry whose name is already among the saved foods is skipped, not an error. */
export const rememberSkipReasonSchema = z.enum(['exists'])

export const rememberEntriesResponseSchema = z.object({
	created: z.array(myFoodResponseSchema),
	skipped: z.array(z.object({ entryId: z.uuid(), reason: rememberSkipReasonSchema })),
})

export type RememberEntriesResponse = z.infer<typeof rememberEntriesResponseSchema>
