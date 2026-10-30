// The memory tools: save_food, save_fact, forget_fact. They never answer on their own — a reply or
// log_food in the same turn does. The model points at saved foods and facts by refs (`m1`, `f1`).
// After any change here: run `pnpm --filter ai-eval eval` and add a line to PROMPT_CHANGELOG.md.
import { z } from 'zod'

import { FALLBACK_FOOD_CATEGORY, factCategorySchema, foodCategorySchema } from '../schemas/enums.js'
import { FACT_TEXT_MAX_LENGTH } from '../schemas/facts.js'
import { MAX_ENTRY_GRAMS, MEMORY_REF_PATTERN, MIN_ENTRY_GRAMS } from '../schemas/food-entry.js'
import { MY_FOOD_NAME_MAX_LENGTH, myFoodPer100gSchema } from '../schemas/my-foods.js'
import { withOpenEnumForModel } from './model-schema.js'

/** Refs the backend gives the confirmed facts in the model context (`f1`…), never database ids. */
export const FACT_REF_PATTERN = /^f\d{1,2}$/

export const MAX_SAVED_FOODS_PER_MESSAGE = 5
export const MAX_FORGOTTEN_FACTS_PER_MESSAGE = 5
export const MAX_FOOD_ALIASES = 5

const gramsSchema = z.number().min(MIN_ENTRY_GRAMS).max(MAX_ENTRY_GRAMS)

export const saveFoodInputSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1)
		.max(MY_FOOD_NAME_MAX_LENGTH)
		.describe("The user's words, nominative"),
	aliases: z
		.array(z.string().trim().min(1).max(MY_FOOD_NAME_MAX_LENGTH))
		.max(MAX_FOOD_ALIASES)
		.default([])
		.describe('Other names the user uses; may be empty'),
	per100g: myFoodPer100gSchema
		.nullable()
		.default(null)
		.describe("Values per 100 g from the label or the user's words; null with fromItemIndex"),
	pieceGrams: gramsSchema.nullable().default(null).describe('Grams of one piece; else null'),
	defaultGrams: gramsSchema.nullable().default(null).describe('Usual portion in grams; else null'),
	// the model sees no list here (it has log_food's); an unknown category costs only an icon
	category: withOpenEnumForModel(
		foodCategorySchema.catch(FALLBACK_FOOD_CATEGORY).nullable().default(null),
		'Same list as log_food; null with fromItemIndex',
	),
	fromItemIndex: z
		.int()
		.min(0)
		.nullable()
		.default(null)
		.describe('Index of the log_food item in this answer to take the values from; else null'),
	updateRef: z
		.string()
		.regex(MEMORY_REF_PATTERN)
		.nullable()
		.default(null)
		.describe('m-ref from "Saved foods" when the user agreed to update it; else null'),
})

export type SaveFoodInput = z.infer<typeof saveFoodInputSchema>

/** One line, as it is stored; the fact guard runs on the backend and answers with a fixed sentence. */
const oneLineSchema = z
	.string()
	.transform((text) => text.replace(/\s+/g, ' ').trim())
	.pipe(z.string().min(1).max(FACT_TEXT_MAX_LENGTH))

export const saveFactInputSchema = z.object({
	text: oneLineSchema.describe('One short sentence without gender forms, e.g. "Не їсть рибу"'),
	category: factCategorySchema.describe('FOOD, SCHEDULE, TRAINING or OTHER'),
	explicit: z
		.boolean()
		.describe('true only when the user asked to remember it; false = a proposal the user confirms'),
})

export type SaveFactInput = z.infer<typeof saveFactInputSchema>

export const forgetFactInputSchema = z.object({
	ref: z.string().regex(FACT_REF_PATTERN).describe('f-ref from "User facts"'),
})

export type ForgetFactInput = z.infer<typeof forgetFactInputSchema>

/** What the memory tools of one answer ask for; empty when the model used none. */
export interface MemoryActions {
	foods: SaveFoodInput[]
	/** At most one per message. */
	fact: SaveFactInput | null
	forgets: ForgetFactInput[]
}

export const NO_MEMORY_ACTIONS: MemoryActions = { foods: [], fact: null, forgets: [] }

export const hasMemoryActions = ({ foods, fact, forgets }: MemoryActions): boolean =>
	foods.length > 0 || fact !== null || forgets.length > 0
