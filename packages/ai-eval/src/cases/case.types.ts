import {
	COPY_REF_PATTERN,
	foodCategorySchema,
	type FoodParseContext,
	foodSourceSchema,
	loggableMealTypeSchema,
	measurementKindSchema,
	statsDaysSchema,
} from '@kus/shared'
import { z } from 'zod'

import { CONTEXT_PRESET_NAMES } from './context-presets.js'
import type { EvalPhoto } from './photo.js'

/**
 * `log` = logged without a question; `clarify` = logged and asked; `log_or_clarify` = either is
 * fine; `edit` = only changed what was logged before (edit tools + reply), nothing new logged;
 * `day_card` = showed a day's card (show_day) instead of answering in words;
 * `close_day` / `stats` = closed the day or showed the stats card, nothing logged next to it.
 */
export const expectedDecisionSchema = z.enum([
	'log',
	'clarify',
	'log_or_clarify',
	'edit',
	'not_food',
	'photo_unusable',
	'reply',
	'day_card',
	'close_day',
	'stats',
])

export type ExpectedDecision = z.infer<typeof expectedDecisionSchema>

/** The languages reply-checks.ts tells apart by their letters. */
export const replyLanguageSchema = z.enum(['uk', 'pl', 'ru'])

export type ReplyLanguage = z.infer<typeof replyLanguageSchema>

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

/** One log_measurement the answer must contain; the whole set must match, `[]` = nothing recorded. */
export const expectedMeasurementSchema = z.object({
	kind: measurementKindSchema,
	value: z.number().positive(),
	/** `YYYY-MM-DD`; without it — the case's today. */
	date: z.iso.date().optional(),
	/** Without it — must not be true. */
	confirmedJump: z.boolean().optional(),
})

/** One delete_measurement the answer must contain. */
export const expectedDeletedMeasurementSchema = z.object({
	kind: measurementKindSchema,
	date: z.iso.date(),
})

export type ExpectedDeletedMeasurement = z.infer<typeof expectedDeletedMeasurementSchema>
export type ExpectedMeasurement = z.infer<typeof expectedMeasurementSchema>
export type ExpectedEdits = z.infer<typeof expectedEditsSchema>
export type ResolutionKind = z.infer<typeof resolutionKindSchema>

export const evalCaseSchema = z
	.object({
		id: z.string().min(1),
		/** The words of the message; may be empty when the case has a photo. */
		text: z.string().default(''),
		/** A photo next to the words: a path relative to data/private/ (.jpg, .png or .webp). */
		image: z.string().min(1).optional(),
		/** A JSON case's day state by name (context-presets.ts); without it — an empty day. */
		contextPreset: z.enum(CONTEXT_PRESET_NAMES).optional(),
		expect: z.object({
			decision: expectedDecisionSchema,
			/** Total kcal of everything logged by the message. */
			kcal: expectedValueSchema.optional(),
			protein: expectedValueSchema.optional(),
			/** Each must appear among the logged items' categories (extra items are fine). */
			categories: z.array(foodCategorySchema).optional(),
			/** For reply cases: substrings the answer must contain (e.g. the remaining kcal). */
			replyIncludes: z.array(z.string()).optional(),
			/** Lower-case substrings; the answer must contain at least one of them. */
			replyIncludesAny: z.array(z.string()).optional(),
			/** Regular expressions (source strings) the answer must all match; "\\d{2}\\.\\d{2}" = a dd.mm date. */
			replyMatches: z.array(z.string().min(1)).optional(),
			/** Lower-case stems the answer must not contain — claims of a change that didn't happen ("змінив"). */
			replyExcludes: z.array(z.string()).optional(),
			/** The reply's language when the message's letters can't tell it (a Polish text without diacritics). */
			replyLang: replyLanguageSchema.optional(),
			edits: expectedEditsSchema.optional(),
			measurements: z.array(expectedMeasurementSchema).optional(),
			/** Some kept clarify option renames the item ("Макарони сухі"). */
			clarifyRenames: z.boolean().optional(),
			/** Whole-day cases: an item (name stem) must land in this meal. */
			itemMeals: z
				.array(z.object({ stem: z.string().min(1), mealType: loggableMealTypeSchema }))
				.optional(),
			/** For clarify cases: stems of the items a question is expected about ("печив"). */
			clarifyAbout: z.array(z.string().min(1)).optional(),
			/** `YYYY-MM-DD` the log_food call must be for (its top-level date; none = the case's today). */
			logDate: z.iso.date().optional(),
			/** Mixed-day messages: the item (name stem) must land on this day. */
			itemDates: z.array(z.object({ stem: z.string().min(1), date: z.iso.date() })).optional(),
			/** At most this many items logged (a feast is one item, not a made-up menu). */
			maxItems: z.int().positive().optional(),
			/** The day card the answer must show (show_day); a null date of the call counts as the case's today. */
			dayCard: z.object({ date: z.iso.date() }).optional(),
			/** The close_day call (a null date counts as the case's today); the verdict is the backend's. */
			closeDay: z
				.object({ date: z.iso.date(), estimatedTotalKcal: z.number().positive().nullable() })
				.optional(),
			/** The show_stats call: its length in days (and its end day, when given). */
			stats: z.object({ days: statsDaysSchema, endDate: z.iso.date().optional() }).optional(),
			/** Exactly these earlier-entry refs (y1, h1) are copied by the logged items; [] = none copied. */
			copyRefs: z.array(z.string().regex(COPY_REF_PATTERN)).optional(),
			/** Exactly these delete_measurement calls; `[]` = none. */
			deletedMeasurements: z.array(expectedDeletedMeasurementSchema).optional(),
			/** Every logged item must carry one of these sources (a label photo → LABEL, a plate → ESTIMATE). */
			sources: z.array(foodSourceSchema).min(1).optional(),
		}),
		/** Where the numbers come from (label text, USDA FDC, typical portion). */
		reference: z.string().min(1),
	})
	.refine((evalCase) => evalCase.text.length > 0 || evalCase.image !== undefined, {
		message: 'a case needs text or an image',
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
	/** The loaded photo of a private case with `image`. */
	photo?: EvalPhoto
}
