// AI tool definitions: one source for the backend, the eval and the JSON schema the model sees.
// After any change here: run `pnpm --filter ai-eval eval` and add a line to PROMPT_CHANGELOG.md.
import { z } from 'zod'

import { mealTypeSchema } from '../schemas/enums.js'
import { foodEntryBaseSchema, refineFoodEntry } from '../schemas/food-entry.js'
import { CATEGORY_DESCRIPTION } from './category-description.js'

export const AI_TOOL_NAMES = {
	logFood: 'log_food',
	clarify: 'clarify',
	notFood: 'not_food',
	reply: 'reply',
} as const

export type AiToolName = (typeof AI_TOOL_NAMES)[keyof typeof AI_TOOL_NAMES]

export const MAX_ITEMS_PER_MESSAGE = 20
export const REPLY_MAX_LENGTH = 500
export const CLARIFY_OPTIONS = { min: 2, max: 4 } as const
const MAX_OPTION_KCAL = 20_000

const replyTextSchema = z.string().trim().min(1).max(REPLY_MAX_LENGTH)

export const aiFoodItemSchema = foodEntryBaseSchema
	.extend({
		name: foodEntryBaseSchema.shape.name.describe(
			'Short dish or product name in the language of the user, e.g. "Гречка варена"',
		),
		grams: foodEntryBaseSchema.shape.grams.describe(
			'Edible weight of the whole portion in grams (for drinks: ml ≈ g)',
		),
		quantity: foodEntryBaseSchema.shape.quantity.describe(
			'Number of pieces when the user counted them ("3 яйця" → 3), else null',
		),
		kcal: foodEntryBaseSchema.shape.kcal.describe('Energy of the whole portion, kcal'),
		protein: foodEntryBaseSchema.shape.protein.describe('Protein of the whole portion, g'),
		fat: foodEntryBaseSchema.shape.fat.describe('Fat of the whole portion, g'),
		carbs: foodEntryBaseSchema.shape.carbs.describe(
			'Carbohydrates of the whole portion excluding fiber, g',
		),
		fiber: foodEntryBaseSchema.shape.fiber.describe(
			'Fiber of the whole portion, g; null if unknown',
		),
		category: foodEntryBaseSchema.shape.category.describe(CATEGORY_DESCRIPTION),
		source: foodEntryBaseSchema.shape.source.describe(
			'LABEL: values the user gave from a package label. MEMORY: taken from a saved food (set memoryRef). REFERENCE: a standard product with well-known values. ESTIMATE: a dish or portion you had to guess',
		),
		confidence: foodEntryBaseSchema.shape.confidence.describe(
			'0..1 — how sure you are about kcal (weighed product ~0.9, "a plate of soup" ~0.4)',
		),
		assumption: foodEntryBaseSchema.shape.assumption.describe(
			'What you assumed, short, in the language of the user ("варена, без олії"); null if nothing',
		),
		memoryRef: foodEntryBaseSchema.shape.memoryRef.describe(
			'Ref of the saved food used ("m1"), only when source is MEMORY; else null',
		),
	})
	.superRefine(refineFoodEntry)

export type AiFoodItem = z.infer<typeof aiFoodItemSchema>

export const logFoodInputSchema = z.object({
	items: z.array(aiFoodItemSchema).min(1).max(MAX_ITEMS_PER_MESSAGE),
	mealType: mealTypeSchema
		.exclude(['OTHER'])
		.nullable()
		.default(null)
		.describe('Only if the user named the meal ("на обід") — else null, the backend uses the time'),
	reply: replyTextSchema.describe(
		'One short warm sentence for the chat in the language of the user. No totals or day sums — the app shows them',
	),
})

export type LogFoodInput = z.infer<typeof logFoodInputSchema>

export const clarifyOptionSchema = z.object({
	label: z.string().trim().min(1).max(60).describe('Short answer chip, e.g. "Варена"'),
	kcal: z
		.number()
		.nonnegative()
		.max(MAX_OPTION_KCAL)
		.describe('Total kcal of the referenced items if this answer is true'),
})

export type ClarifyOption = z.infer<typeof clarifyOptionSchema>

export const clarifyInputSchema = z.object({
	question: z
		.string()
		.trim()
		.min(1)
		.max(200)
		.describe('Short question in the language of the user'),
	itemIndexes: z
		.array(z.int().nonnegative())
		.min(1)
		.max(MAX_ITEMS_PER_MESSAGE)
		// a repeated index would double the item in the impact share and break the entry link key
		.refine((indexes) => new Set(indexes).size === indexes.length, {
			message: 'itemIndexes must not repeat',
		})
		.describe('0-based indexes of the log_food items this question is about'),
	options: z.array(clarifyOptionSchema).min(CLARIFY_OPTIONS.min).max(CLARIFY_OPTIONS.max),
})

export type ClarifyInput = z.infer<typeof clarifyInputSchema>

export const notFoodInputSchema = z.object({
	reply: replyTextSchema.describe('Friendly short answer in the language of the user'),
})

export type NotFoodInput = z.infer<typeof notFoodInputSchema>

export const replyInputSchema = z.object({
	text: replyTextSchema.describe('Short answer in the language of the user'),
})

export type ReplyInput = z.infer<typeof replyInputSchema>

export const AI_TOOL_SCHEMAS: Record<AiToolName, z.ZodType> = {
	log_food: logFoodInputSchema,
	clarify: clarifyInputSchema,
	not_food: notFoodInputSchema,
	reply: replyInputSchema,
}

const AI_TOOL_DESCRIPTIONS: Record<AiToolName, string> = {
	log_food:
		'Log everything the user says they ate or drank in this message. Always log your best estimate, even when you also ask a clarify question.',
	clarify:
		'Ask about logged items only when the answer changes their kcal a lot (by 80+ kcal and 15%+). Call together with log_food, at most 2 per message.',
	not_food:
		'The user claims to have eaten something inedible ("з\'їв камінь", "з\'їв телефон"). Nothing is logged.',
	reply:
		'Plain conversation: greetings, thanks, questions (including "how much can I still eat today" — answer from the day context). Nothing is logged.',
}

/** OpenAI-compatible tool definition, as OpenRouter expects it. */
export interface AiFunctionTool {
	type: 'function'
	function: { name: string; description: string; parameters: Record<string, unknown> }
}

const toParameters = (schema: z.ZodType): Record<string, unknown> => {
	// output side: defaulted fields stay required (nullable), which models follow more reliably
	const { $schema: _schema, ...parameters } = z.toJSONSchema(schema, { target: 'draft-07' })
	return parameters
}

export const getAiFunctionTools = (): AiFunctionTool[] =>
	Object.values(AI_TOOL_NAMES).map((name) => ({
		type: 'function',
		function: {
			name,
			description: AI_TOOL_DESCRIPTIONS[name],
			parameters: toParameters(AI_TOOL_SCHEMAS[name]),
		},
	}))
