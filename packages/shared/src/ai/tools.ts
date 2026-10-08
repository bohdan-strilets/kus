// AI tool definitions: one source for the backend, the eval and the JSON schema the model sees.
// After any change here: run `pnpm --filter ai-eval eval` and add a line to PROMPT_CHANGELOG.md.
import { z } from 'zod'

import { mealTypeSchema } from '../schemas/enums.js'
import {
	foodEntryBaseSchema,
	MAX_ENTRY_GRAMS,
	MIN_ENTRY_GRAMS,
	refineFoodEntry,
} from '../schemas/food-entry.js'
import { CATEGORY_DESCRIPTION } from './category-description.js'
import {
	correctEntryInputSchema,
	deleteEntryInputSchema,
	resolveClarificationInputSchema,
	restoreEntryInputSchema,
} from './edit-tools.js'

export const AI_TOOL_NAMES = {
	logFood: 'log_food',
	clarify: 'clarify',
	correctEntry: 'correct_entry',
	deleteEntry: 'delete_entry',
	restoreEntry: 'restore_entry',
	resolveClarification: 'resolve_clarification',
	notFood: 'not_food',
	reply: 'reply',
} as const

export type AiToolName = (typeof AI_TOOL_NAMES)[keyof typeof AI_TOOL_NAMES]

export const MAX_ITEMS_PER_MESSAGE = 20
export const REPLY_MAX_LENGTH = 500
export const CLARIFY_OPTIONS = { min: 2, max: 4 } as const
const MAX_OPTION_KCAL = 20_000
/** Every item of a message at its maximum weight. */
const MAX_OPTION_GRAMS = MAX_ENTRY_GRAMS * MAX_ITEMS_PER_MESSAGE

const replyTextSchema = z.string().trim().min(1).max(REPLY_MAX_LENGTH)

/** OTHER may repeat within a day, so a message never logs into it. */
export const loggableMealTypeSchema = mealTypeSchema.exclude(['OTHER'])

export type LoggableMealType = z.infer<typeof loggableMealTypeSchema>

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
			'What you assumed, in the language of the user, at most ~60 characters ("варена, без олії"); null if nothing',
		),
		memoryRef: foodEntryBaseSchema.shape.memoryRef.describe(
			'Ref of the saved food used ("m1"), only when source is MEMORY; else null',
		),
		mealType: loggableMealTypeSchema
			.nullable()
			.default(null)
			.describe(
				'Meal of this item when the message names several ("сніданок: …, обід: …"); else null — the message-level mealType or the clock decides',
			),
	})
	.superRefine(refineFoodEntry)

export type AiFoodItem = z.infer<typeof aiFoodItemSchema>

export const logFoodInputSchema = z.object({
	items: z.array(aiFoodItemSchema).min(1).max(MAX_ITEMS_PER_MESSAGE),
	mealType: loggableMealTypeSchema
		.nullable()
		.default(null)
		.describe(
			'Only if the user named one meal for the whole message ("на обід") — else null; items may name their own',
		),
	reply: replyTextSchema.describe(
		'1–2 short warm sentences for the chat in the language of the user. No totals or day sums — the app shows them',
	),
})

export type LogFoodInput = z.infer<typeof logFoodInputSchema>

const optionMacroSchema = z.number().nonnegative().max(MAX_OPTION_GRAMS)

/**
 * An answer carries the full values of the referenced items if it is true, so tapping it
 * re-logs them without another model call. Checked against the items in clarifications.ts.
 */
export const clarifyOptionSchema = z.object({
	label: z.string().trim().min(1).max(60).describe('Short answer chip, e.g. "Варена"'),
	kcal: z
		.number()
		.nonnegative()
		.max(MAX_OPTION_KCAL)
		.describe('Total kcal of the referenced items if this answer is true'),
	protein: optionMacroSchema.describe('Total protein of the referenced items for this answer, g'),
	fat: optionMacroSchema.describe('Total fat of the referenced items for this answer, g'),
	carbs: optionMacroSchema.describe(
		'Total carbohydrates excluding fiber of the referenced items for this answer, g',
	),
	fiber: optionMacroSchema
		.nullable()
		.default(null)
		.describe('Total fiber of the referenced items for this answer, g; null if unknown'),
	grams: z
		.number()
		.min(MIN_ENTRY_GRAMS)
		.max(MAX_OPTION_GRAMS)
		.nullable()
		.default(null)
		.describe(
			'Total grams of the referenced items only if this answer changes the portion weight ("маленька / велика тарілка"); else null',
		),
	name: foodEntryBaseSchema.shape.name
		.nullable()
		.default(null)
		.describe(
			'New item name if this answer changes what the item is ("Макарони сухі" for "Макарони варені"); only for a question about one item; else null',
		),
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
	reply: replyTextSchema.describe('1–2 friendly short sentences in the language of the user'),
})

export type NotFoodInput = z.infer<typeof notFoodInputSchema>

export const replyInputSchema = z.object({
	text: replyTextSchema.describe('1–2 short sentences in the language of the user'),
})

export type ReplyInput = z.infer<typeof replyInputSchema>

export const AI_TOOL_SCHEMAS: Record<AiToolName, z.ZodType> = {
	log_food: logFoodInputSchema,
	clarify: clarifyInputSchema,
	correct_entry: correctEntryInputSchema,
	delete_entry: deleteEntryInputSchema,
	restore_entry: restoreEntryInputSchema,
	resolve_clarification: resolveClarificationInputSchema,
	not_food: notFoodInputSchema,
	reply: replyInputSchema,
}

const AI_TOOL_DESCRIPTIONS: Record<AiToolName, string> = {
	log_food:
		'Log everything the user says they ate or drank in this message. Always log your best estimate, even when you also ask a clarify question. Never to fix something already logged.',
	clarify:
		'Ask about logged items only when the answer changes their kcal a lot (by 80+ kcal and 15%+). Call together with log_food, at most 2 per message.',
	correct_entry:
		'Change entries already logged today (by ref): portion weight, values or what the food is. Use instead of logging the food again.',
	delete_entry: 'Delete entries logged today (by ref) that the user wants removed.',
	restore_entry: 'Bring back entries deleted today (by ref), e.g. "поверни".',
	resolve_clarification:
		'The user answers an open question in words: close it with the option that matches, with values between two options, or (both null) without values — then change the entry with correct_entry.',
	not_food:
		'The user claims to have eaten something inedible ("з\'їв камінь", "з\'їв телефон"). Nothing is logged.',
	reply:
		'Plain conversation: greetings, thanks, questions (including "how much can I still eat today" — answer from the day context). Nothing is logged. Also the chat answer of a message that only changes entries (correct_entry, delete_entry, restore_entry, resolve_clarification).',
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
