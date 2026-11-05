// AI tool definitions: one source for the backend, the eval and the JSON schema the model sees.
// After any change here: run `pnpm --filter ai-eval eval` and add a line to PROMPT_CHANGELOG.md.
import { z } from 'zod'

import {
	mealTypeSchema,
	measurementKindSchema,
	programModeSchema,
	workoutPlaceSchema,
} from '../schemas/enums.js'
import {
	foodEntryBaseSchema,
	MAX_ENTRY_GRAMS,
	MIN_ENTRY_GRAMS,
	refineFoodEntry,
} from '../schemas/food-entry.js'
import {
	PROGRAM_PER_WEEK_MAX,
	PROGRAM_TEMPLATES_MAX,
	PROGRAM_TITLE_MAX_LENGTH,
} from '../schemas/programs.js'
import { STATS_DAYS_MAX, STATS_DAYS_MIN, statsDaysSchema } from '../schemas/stats-card.js'
import { MAX_ESTIMATED_DAY_KCAL } from './close-day.js'
import { CATEGORY_DESCRIPTION } from './category-description.js'
import {
	correctEntryInputSchema,
	deleteEntryInputSchema,
	resolveClarificationInputSchema,
	restoreEntryInputSchema,
} from './edit-tools.js'
import { COPY_REF_PATTERN } from './history-context.js'
import { forgetFactInputSchema, saveFactInputSchema, saveFoodInputSchema } from './memory-tools.js'
import { toModelParameters } from './model-schema.js'
import { programTemplateInputSchema } from './program-tools.js'
import {
	MAX_EXERCISES_PER_WORKOUT,
	MAX_WORKOUT_KCAL,
	MAX_WORKOUT_MINUTES,
	EXERCISE_GROUP_FIX_PATTERN,
	TEMPLATE_REF_PATTERN,
	WORKOUT_REF_PATTERN,
	workoutExerciseSchema,
} from './workout-tools.js'

export const AI_TOOL_NAMES = {
	logFood: 'log_food',
	logWorkout: 'log_workout',
	proposeProgram: 'propose_program',
	logMeasurement: 'log_measurement',
	deleteMeasurement: 'delete_measurement',
	clarify: 'clarify',
	correctEntry: 'correct_entry',
	deleteEntry: 'delete_entry',
	restoreEntry: 'restore_entry',
	resolveClarification: 'resolve_clarification',
	notFood: 'not_food',
	photoUnusable: 'photo_unusable',
	showDay: 'show_day',
	closeDay: 'close_day',
	showStats: 'show_stats',
	saveFood: 'save_food',
	saveFact: 'save_fact',
	forgetFact: 'forget_fact',
	reply: 'reply',
} as const

export type AiToolName = (typeof AI_TOOL_NAMES)[keyof typeof AI_TOOL_NAMES]

export const MAX_ITEMS_PER_MESSAGE = 20
export const REPLY_MAX_LENGTH = 1000
export const CLARIFY_OPTIONS = { min: 2, max: 4 } as const
const MAX_OPTION_KCAL = 20_000
/** Every item of a message at its maximum weight. */
const MAX_OPTION_GRAMS = MAX_ENTRY_GRAMS * MAX_ITEMS_PER_MESSAGE

const replyTextSchema = z.string().trim().min(1).max(REPLY_MAX_LENGTH)
// only reply.text: a whole recipe (~1 500 characters asked in "Recipes") with room before a retry
export const REPLY_TEXT_MAX_LENGTH = 2000
const replyLongTextSchema = z.string().trim().min(1).max(REPLY_TEXT_MAX_LENGTH)

/** OTHER may repeat within a day, so a message never logs into it. */
export const loggableMealTypeSchema = mealTypeSchema.exclude(['OTHER'])

export type LoggableMealType = z.infer<typeof loggableMealTypeSchema>

export const aiFoodItemSchema = foodEntryBaseSchema
	.extend({
		name: foodEntryBaseSchema.shape.name.describe(
			`The food in the user's own words, in the nominative, spelled correctly, e.g. "Гречка варена"`,
		),
		grams: foodEntryBaseSchema.shape.grams.describe(
			'Edible weight of the whole portion in grams (for drinks: ml ≈ g)',
		),
		quantity: foodEntryBaseSchema.shape.quantity.describe(
			'Number of pieces, only when the user counted them ("3 яйця" → 3)',
		),
		kcal: foodEntryBaseSchema.shape.kcal.describe('Energy of the whole portion, kcal'),
		protein: foodEntryBaseSchema.shape.protein.describe('Protein of the whole portion, g'),
		fat: foodEntryBaseSchema.shape.fat.describe('Fat of the whole portion, g'),
		carbs: foodEntryBaseSchema.shape.carbs.describe(
			'Carbohydrates of the whole portion excluding fiber, g',
		),
		fiber: foodEntryBaseSchema.shape.fiber.describe('Fiber of the whole portion, g, if known'),
		category: foodEntryBaseSchema.shape.category.describe(CATEGORY_DESCRIPTION),
		source: foodEntryBaseSchema.shape.source.describe(
			'LABEL: values the user gave from a package label. MEMORY: taken from a saved food (set memoryRef). REFERENCE: a standard product with well-known values. ESTIMATE: a dish or portion you had to guess',
		),
		confidence: foodEntryBaseSchema.shape.confidence.describe(
			'0..1 — how sure you are about kcal (weighed product ~0.9, "a plate of soup" ~0.4)',
		),
		assumption: foodEntryBaseSchema.shape.assumption.describe(
			'What you assumed, in the language of the user, at most ~60 characters ("варена, без олії"), if anything',
		),
		memoryRef: foodEntryBaseSchema.shape.memoryRef.describe(
			'Ref of the saved food used ("m1"), only when source is MEMORY',
		),
		copyRef: z
			.string()
			.regex(COPY_REF_PATTERN)
			.nullable()
			.default(null)
			.describe(
				'Ref of an entry from "Earlier entries" ("y1" yesterday, "h1" older) when the user says the food is the same as then; the backend copies its values and scales them to grams. Never together with memoryRef',
			),
		mealType: loggableMealTypeSchema
			.nullable()
			.default(null)
			.describe('Meal of this item, only when this message names several ("сніданок: …, обід: …")'),
		date: z.iso
			.date()
			.nullable()
			.default(null)
			.describe('Day of this item, only when one message has food of different days'),
	})
	// a copyRef item takes its numbers from the copied entry on the backend; the model's own
	// macros are never stored, so only the bounds are checked (the parser rejects an unknown ref)
	.superRefine((item, context) => {
		refineFoodEntry(item, context, { isMacrosCheckSkipped: item.copyRef !== null })
	})

export type AiFoodItem = z.infer<typeof aiFoodItemSchema>

export const logFoodInputSchema = z.object({
	items: z.array(aiFoodItemSchema).min(1).max(MAX_ITEMS_PER_MESSAGE),
	date: z.iso
		.date()
		.nullable()
		.default(null)
		.describe(
			'Only for another day the user names ("вчора", "на завтра", "у п\'ятницю"): YYYY-MM-DD from "Days"',
		),
	mealType: loggableMealTypeSchema
		.nullable()
		.default(null)
		.describe(
			'Only if this message names one meal for the whole message ("на обід"). Items may name their own',
		),
	reply: replyTextSchema.describe(
		`1–2 short warm sentences for the chat in the language of the user's message, in your own words. No totals or day sums — the app shows them`,
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
	protein: optionMacroSchema,
	fat: optionMacroSchema,
	carbs: optionMacroSchema.describe(
		'Total carbohydrates excluding fiber of the referenced items for this answer, g',
	),
	// fiber, grams and name: the rules live in "Clarify" of the prompt
	fiber: optionMacroSchema.nullable().default(null),
	grams: z.number().min(MIN_ENTRY_GRAMS).max(MAX_OPTION_GRAMS).nullable().default(null),
	name: foodEntryBaseSchema.shape.name.nullable().default(null),
})

export type ClarifyOption = z.infer<typeof clarifyOptionSchema>

/** value — how much or what state of the same food; rename — which food it really was. */
export const clarifyKindSchema = z.enum(['value', 'rename'])

export type ClarifyKind = z.infer<typeof clarifyKindSchema>

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
	kind: clarifyKindSchema
		.default('value')
		.describe(
			'"rename" only when the item is a food that doesn\'t exist or a strange name ("свинячі крильця") and each option is a different real food with its name; else "value"',
		),
})

export type ClarifyInput = z.infer<typeof clarifyInputSchema>

export const notFoodInputSchema = z.object({
	reply: replyTextSchema.describe('1–2 friendly short sentences in the language of the user'),
})

export type NotFoodInput = z.infer<typeof notFoodInputSchema>

/** no_food — nothing edible on the photo; unreadable — a label too blurry, dark or cut off to read. */
export const photoUnusableReasonSchema = z.enum(['no_food', 'unreadable'])

export type PhotoUnusableReason = z.infer<typeof photoUnusableReasonSchema>

export const photoUnusableInputSchema = z.object({
	reason: photoUnusableReasonSchema.describe(
		'no_food: no food on the photo. unreadable: a label you cannot read (blur, dark, cut off)',
	),
	reply: replyTextSchema.describe(
		'1–2 friendly short sentences in the language of the user asking to retake the photo or type what it was',
	),
})

export type PhotoUnusableInput = z.infer<typeof photoUnusableInputSchema>

export const replyInputSchema = z.object({
	text: replyLongTextSchema.describe(
		`The answer in the language of the user's message; length and format as in "Tone"`,
	),
	attach: z
		.enum(['program'])
		.nullable()
		.default(null)
		.describe('"program" shows the active program as a card next to the text; see "Program"'),
})

export type ReplyInput = z.infer<typeof replyInputSchema>

export const logMeasurementInputSchema = z.object({
	kind: measurementKindSchema.describe('WEIGHT in kg, WAIST in cm'),
	value: z
		.number()
		.positive()
		.describe('The number as the user wrote it, one decimal: 82.4 (kg) or 94 (cm)'),
	date: z.iso
		.date()
		.nullable()
		.default(null)
		.describe(
			'Only for another day: YYYY-MM-DD from "Days", never tomorrow; up to 3 days back, or an earlier listed value to fix it',
		),
	confirmedJump: z
		.boolean()
		.default(false)
		.describe('true only after the user confirmed an unusual weight change in a later message'),
})

export type LogMeasurementInput = z.infer<typeof logMeasurementInputSchema>

export const deleteMeasurementInputSchema = z.object({
	kind: measurementKindSchema.describe('WEIGHT or WAIST'),
	date: z.iso.date().describe('YYYY-MM-DD of the listed value to remove'),
})

export type DeleteMeasurementInput = z.infer<typeof deleteMeasurementInputSchema>

export const showDayInputSchema = z.object({
	date: z.iso
		.date()
		.nullable()
		.default(null)
		.describe('Only for another day: YYYY-MM-DD from "Days", any earlier day or tomorrow'),
	reply: replyTextSchema.describe('One short sentence next to the card. See "Day card".'),
})

export type ShowDayInput = z.infer<typeof showDayInputSchema>

export const closeDayInputSchema = z.object({
	date: z.iso
		.date()
		.nullable()
		.default(null)
		.describe('Only for another day: YYYY-MM-DD from "Days" of the day to close, never tomorrow'),
	estimatedTotalKcal: z
		.number()
		.positive()
		.max(MAX_ESTIMATED_DAY_KCAL)
		.nullable()
		.default(null)
		.describe('Total kcal of the whole day, only when the user named it. See "Closing the day"'),
	reply: replyTextSchema.describe('One short sentence next to the card. See "Closing the day".'),
})

export type CloseDayInput = z.infer<typeof closeDayInputSchema>

export const showStatsInputSchema = z.object({
	days: statsDaysSchema.describe(
		`How many days the period covers, ${STATS_DAYS_MIN}–${STATS_DAYS_MAX}, ending on endDate`,
	),
	endDate: z.iso
		.date()
		.nullable()
		.default(null)
		.describe('Only if the period ends before today: YYYY-MM-DD'),
	reply: replyTextSchema.describe('One short sentence next to the card, no numbers.'),
	advice: z
		.boolean()
		.default(false)
		.describe('true when the user also asks for advice on the period; see "Stats"'),
})

export type ShowStatsInput = z.infer<typeof showStatsInputSchema>

export const logWorkoutInputSchema = z.object({
	date: z.iso.date().nullable().default(null).describe('Only for another day: from "Days"'),
	place: workoutPlaceSchema.nullable().default(null).describe('Only if the user said where'),
	durationMin: z
		.int()
		.min(1)
		.max(MAX_WORKOUT_MINUTES)
		.nullable()
		.default(null)
		.describe('Total minutes, only if said'),
	kcalBurned: z
		.int()
		.min(1)
		.max(MAX_WORKOUT_KCAL)
		.nullable()
		.default(null)
		.describe('Only a number the user said'),
	// may be empty only with appendRef + finish or with exerciseGroups (the parser checks)
	exercises: z
		.array(workoutExerciseSchema)
		.max(MAX_EXERCISES_PER_WORKOUT)
		.describe('Only what this message adds; empty with appendRef + finish for a plain "все"'),
	replaceRef: z
		.string()
		.regex(WORKOUT_REF_PATTERN)
		.nullable()
		.default(null)
		.describe('w-ref from "Today\'s workouts", only to replace that whole workout'),
	appendRef: z
		.string()
		.regex(WORKOUT_REF_PATTERN)
		.nullable()
		.default(null)
		.describe('w-ref from "Today\'s workouts", only to add to that workout'),
	templateRef: z
		.string()
		.regex(TEMPLATE_REF_PATTERN)
		.nullable()
		.default(null)
		.describe(
			't-ref from "Program", only when the user names the template ("зробив Б") or logs the same exercises as it; merely similar → null',
		),
	finish: z
		.boolean()
		.default(false)
		.describe(
			'true when the user says they are done (even just "все"), or tells a whole workout in one message',
		),
	exerciseGroups: z
		.array(z.string().regex(EXERCISE_GROUP_FIX_PATTERN))
		.default([])
		.describe('"x1:LEGS" when the user corrects the group of an exercise from "Exercises"'),
	reply: replyTextSchema.describe("Short chat reply in the language of the user's message"),
})

export type LogWorkoutInput = z.infer<typeof logWorkoutInputSchema>

export const proposeProgramInputSchema = z.object({
	title: z
		.string()
		.trim()
		.min(1)
		.max(PROGRAM_TITLE_MAX_LENGTH)
		.nullable()
		.default(null)
		.describe('Short name, e.g. "Все тіло"'),
	// no description: the rule lives in "Program" of the context
	mode: programModeSchema,
	perWeek: z
		.int()
		.min(1)
		.max(PROGRAM_PER_WEEK_MAX)
		.nullable()
		.default(null)
		.describe('Workouts per week, if known'),
	pinnedRef: z
		.string()
		.regex(TEMPLATE_REF_PATTERN)
		.nullable()
		.default(null)
		.describe('t-ref of the template for mode SINGLE'),
	templates: z.array(programTemplateInputSchema).min(1).max(PROGRAM_TEMPLATES_MAX),
	reply: replyTextSchema.describe(
		'One or two sentences about the idea of the program, in the language of the user. Never list exercises, changes or minutes — the card shows them',
	),
})

export type ProposeProgramInput = z.infer<typeof proposeProgramInputSchema>

export const AI_TOOL_SCHEMAS: Record<AiToolName, z.ZodType> = {
	log_food: logFoodInputSchema,
	log_workout: logWorkoutInputSchema,
	propose_program: proposeProgramInputSchema,
	log_measurement: logMeasurementInputSchema,
	delete_measurement: deleteMeasurementInputSchema,
	clarify: clarifyInputSchema,
	correct_entry: correctEntryInputSchema,
	delete_entry: deleteEntryInputSchema,
	restore_entry: restoreEntryInputSchema,
	resolve_clarification: resolveClarificationInputSchema,
	not_food: notFoodInputSchema,
	photo_unusable: photoUnusableInputSchema,
	show_day: showDayInputSchema,
	close_day: closeDayInputSchema,
	show_stats: showStatsInputSchema,
	save_food: saveFoodInputSchema,
	save_fact: saveFactInputSchema,
	forget_fact: forgetFactInputSchema,
	reply: replyInputSchema,
}

const AI_TOOL_DESCRIPTIONS: Record<AiToolName, string> = {
	log_workout: 'Log a workout or part of it. See "Workouts".',
	propose_program:
		'Propose a new or changed training program, always the whole program. Nothing is saved until the user accepts the card. See "Program".',
	log_food:
		'Log everything the user says they ate or drank in this message. See "Logging food". Never to fix something already logged.',
	log_measurement: 'Log body weight (kg) or waist (cm) the user reports. See "Weight and waist".',
	delete_measurement:
		'Remove a wrong weight or waist value listed in the context, by kind and date. Goes with one reply.',
	show_day: 'Show the card of a day. See "Day card".',
	close_day: 'The user closes a day: show its card with the verdict. See "Closing the day".',
	show_stats: 'Show the summary of a period of 2–92 days. See "Stats".',
	save_food: 'Save a food to the user\'s memory, only when they ask. See "Memory".',
	save_fact: 'Remember one lasting thing about the user. See "Memory".',
	forget_fact: 'Forget a fact from "User facts". See "Memory".',
	clarify:
		'Ask about logged items, together with log_food. See "Clarify"; kind "rename" has no kcal threshold.',
	correct_entry:
		'Change entries already logged today (by ref): portion weight, values or what the food is. Use instead of logging the food again.',
	delete_entry:
		'Delete entries ("e1") or workouts ("w1") logged today that the user wants removed.',
	restore_entry: 'Bring back entries or workouts deleted today (by ref), e.g. "поверни".',
	resolve_clarification: 'The user answers an open question in words. See "Fixing what is logged".',
	not_food: 'The user claims to have eaten something inedible. Nothing is logged.',
	photo_unusable:
		'Only for a message with a photo: no food on it, or the label cannot be read. Nothing is logged.',
	reply:
		'Conversation and answers; nothing is logged. Also the chat answer next to the edit and memory tools.',
}

/** OpenAI-compatible tool definition, as OpenRouter expects it. */
export interface AiFunctionTool {
	type: 'function'
	function: { name: string; description: string; parameters: Record<string, unknown> }
}

/** Tools the model sees bare (types, enums, descriptions): their rules live in zod and the parser. */
const BARE_TOOLS: ReadonlySet<AiToolName> = new Set([
	AI_TOOL_NAMES.saveFood,
	AI_TOOL_NAMES.saveFact,
	AI_TOOL_NAMES.forgetFact,
])

export const getAiFunctionTools = (): AiFunctionTool[] =>
	Object.values(AI_TOOL_NAMES).map((name) => ({
		type: 'function',
		function: {
			name,
			description: AI_TOOL_DESCRIPTIONS[name],
			parameters: toModelParameters(AI_TOOL_SCHEMAS[name], { isBare: BARE_TOOLS.has(name) }),
		},
	}))
