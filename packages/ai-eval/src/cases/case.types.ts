import {
	addressFormSchema,
	COPY_REF_PATTERN,
	EXERCISE_GROUP_FIX_PATTERN,
	exerciseKindSchema,
	FACT_REF_PATTERN,
	factCategorySchema,
	foodCategorySchema,
	foodSourceSchema,
	loggableMealTypeSchema,
	mealTypeSchema,
	MEMORY_REF_PATTERN,
	measurementKindSchema,
	muscleGroupSchema,
	programModeSchema,
	statsDaysSchema,
	TEMPLATE_REF_PATTERN,
	WORKOUT_REF_PATTERN,
	workoutPlaceSchema,
} from '@kus/shared'
import { z } from 'zod'

import type { CaseContext } from '../case-context.js'
import { CONTEXT_PRESET_NAMES } from './context-presets.js'
import type { EvalPhoto } from './photo.js'

/**
 * `log` = logged without a question; `clarify` = logged and asked; `log_or_clarify` = either is
 * fine; `edit` = only changed what was logged before (edit tools + reply), nothing new logged;
 * `day_card` = showed a day's card (show_day) instead of answering in words;
 * `close_day` / `stats` = closed the day or showed the stats card, nothing logged next to it;
 * `log_or_reply` = logged without a question or only replied with a question in words, both fine
 * (the case judges the rest, e.g. `copyRefsAnyOf`);
 * `workout` = logged a training (log_workout), no food; `workout_or_reply` = a training or only a
 * reply, either is fine (the case judges the rest, e.g. `noAppend`); `program` = propose_program.
 */
export const expectedDecisionSchema = z.enum([
	'log',
	'clarify',
	'log_or_clarify',
	'log_or_reply',
	'edit',
	'not_food',
	'photo_unusable',
	'reply',
	'day_card',
	'close_day',
	'stats',
	'workout',
	'workout_or_reply',
	'program',
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

/** One exercise of an expected workout; every field given is checked. */
export const expectedWorkoutExerciseSchema = z.object({
	/** Lower-case stem the exercise name must contain ("жим"). */
	nameIncludes: z.string().min(1),
	kind: exerciseKindSchema.optional(),
	/** Sets after the groups are expanded, warm-ups included. */
	sets: z.int().nonnegative().optional(),
	warmupSets: z.int().nonnegative().optional(),
	/** The heaviest working (not warm-up) weight, kg; null = no weight at all (body weight). */
	weightKg: z.number().nonnegative().nullable().optional(),
	/** Reps of the first working set. */
	reps: z.int().positive().optional(),
	durationMin: z.number().positive().optional(),
	distanceKm: z.number().positive().optional(),
	/** An "x1" of the case context, or null for a new exercise. */
	exerciseRef: z.string().nullable().optional(),
	/**
	 * The group the backend would store: the shared dictionary's, else the model's (cardio = null).
	 * With `isModelGroup` — the model's own value, for a name the dictionary has no group for.
	 */
	muscleGroup: muscleGroupSchema.nullable().optional(),
	isModelGroup: z.literal(true).optional(),
})

/** One log_workout the answer must contain; its exercises are exactly these. */
export const expectedWorkoutSchema = z
	.object({
		/** `YYYY-MM-DD` as the model sends it; null = today. */
		date: z.iso.date().nullable().optional(),
		place: workoutPlaceSchema.nullable().optional(),
		durationMin: z.number().positive().nullable().optional(),
		/** null = the user named no number, so none may be set. */
		kcalBurned: z.number().positive().nullable().optional(),
		/** The "w1" this call replaces; null = a new workout. */
		replaceRef: z.string().regex(WORKOUT_REF_PATTERN).nullable().optional(),
		/** The "w1" this call adds to; null = not an append. */
		appendRef: z.string().regex(WORKOUT_REF_PATTERN).nullable().optional(),
		/** The `t1` of «Program» the workout is bound to; null = not bound to a template. */
		templateRef: z.string().regex(TEMPLATE_REF_PATTERN).nullable().optional(),
		finish: z.boolean().optional(),
		/** Exactly these group fixes (`x1:LEGS`), in any order; `[]` = none. */
		exerciseGroups: z.array(z.string().regex(EXERCISE_GROUP_FIX_PATTERN)).optional(),
		/** Empty only for a finish of a session or a group fix, as the parser allows. */
		exercises: z.array(expectedWorkoutExerciseSchema),
	})
	.refine(
		(workout) =>
			workout.exercises.length > 0 ||
			(workout.appendRef && workout.finish) ||
			(workout.exerciseGroups?.length ?? 0) > 0,
		{ message: 'no exercises: only for appendRef + finish or exerciseGroups' },
	)

/** One save_food the answer must contain; every field given is checked. */
export const expectedSavedFoodSchema = z.object({
	/** Lower-case stem the saved name must contain ("кабаноси"). */
	nameIncludes: z.string().min(1).optional(),
	/** The log_food item the values are taken from; null = standalone values. */
	fromItemIndex: z.int().nonnegative().nullable().optional(),
	/** The m-ref being updated; null = a new food. */
	updateRef: z.string().regex(MEMORY_REF_PATTERN).nullable().optional(),
	hasPer100g: z.boolean().optional(),
	pieceGrams: z.number().positive().nullable().optional(),
	defaultGrams: z.number().positive().nullable().optional(),
	category: foodCategorySchema.optional(),
})

/** The save_fact the answer must contain; every field given is checked. */
export const expectedFactSchema = z.object({
	explicit: z.boolean().optional(),
	category: factCategorySchema.optional(),
	/** Lower-case substrings; the saved text must contain at least one. */
	textIncludesAny: z.array(z.string().min(1)).min(1).optional(),
	/** Lower-case substrings the saved text must not contain ("алерг"). */
	textExcludes: z.array(z.string().min(1)).optional(),
	/** No save_fact is fine too; a saved one must match the fields above. */
	isOptional: z.boolean().optional(),
})

/**
 * What the memory tools must do. Unset part = not judged; `foods: []` / `forgets: []` = none,
 * `fact: null` = no save_fact (NO_MEMORY_CALLS in case-builders.ts sets all three).
 */
export const expectedMemorySchema = z.object({
	foods: z.array(expectedSavedFoodSchema).optional(),
	fact: expectedFactSchema.nullable().optional(),
	forgets: z.array(z.string().regex(FACT_REF_PATTERN)).optional(),
})

const countRangeSchema = z
	.object({ min: z.int().nonnegative(), max: z.int().nonnegative() })
	.refine(({ min, max }) => min <= max, 'min > max')

/** One exercise a template must (or, with `absent`, must not) contain. */
export const expectedProgramExerciseSchema = z.object({
	/** Lower-case stem of the exercise name ("присід"). */
	nameIncludes: z.string().min(1),
	absent: z.literal(true).optional(),
})

/** One template of the proposed program; found by its name, every field given is checked. */
export const expectedProgramTemplateSchema = z.object({
	/** Lower-case stem of the template name ("тренування б"). */
	nameIncludes: z.string().min(1).optional(),
	/** Exactly these ISO weekdays. */
	weekdays: z.array(z.int().min(1).max(7)).optional(),
	exercises: z.array(expectedProgramExerciseSchema).optional(),
	exerciseCount: countRangeSchema.optional(),
})

/** What propose_program must carry; every field given is checked, the whole program at once. */
export const expectedProgramSchema = z.object({
	/** One mode or any of several. */
	mode: z.union([programModeSchema, z.array(programModeSchema).min(1)]).optional(),
	templateCount: countRangeSchema.optional(),
	/** Each is matched to its own template of the answer. */
	templates: z.array(expectedProgramTemplateSchema).optional(),
	/** The name of a template of the case's program; pinnedRef must be its t-ref. */
	pinnedRefOf: z.string().min(1).optional(),
	/** No weight on any exercise: nothing was said and there is no history. */
	noInventedWeights: z.literal(true).optional(),
	/** Every template of the case's program comes back under its own t-ref. */
	keepsRefs: z.literal(true).optional(),
	/** Every template of the answer has this many exercises. */
	exerciseCount: countRangeSchema.optional(),
})

export type ExpectedProgram = z.infer<typeof expectedProgramSchema>
export type ExpectedProgramTemplate = z.infer<typeof expectedProgramTemplateSchema>
export type ExpectedSavedFood = z.infer<typeof expectedSavedFoodSchema>
export type ExpectedFact = z.infer<typeof expectedFactSchema>
export type ExpectedMemory = z.infer<typeof expectedMemorySchema>
export type ExpectedWorkoutExercise = z.infer<typeof expectedWorkoutExerciseSchema>
export type ExpectedWorkout = z.infer<typeof expectedWorkoutSchema>

export type ExpectedDeletedMeasurement = z.infer<typeof expectedDeletedMeasurementSchema>
export type ExpectedMeasurement = z.infer<typeof expectedMeasurementSchema>
export type ExpectedEdits = z.infer<typeof expectedEditsSchema>
export type ResolutionKind = z.infer<typeof resolutionKindSchema>

/** An entry of the user's past days that find_food searches (scope history), one per distinct name. */
export const historyEntrySchema = z.object({
	/** `YYYY-MM-DD` */
	date: z.iso.date(),
	mealType: mealTypeSchema,
	name: z.string().min(1),
	grams: z.number().positive(),
	kcal: z.number().nonnegative(),
	source: foodSourceSchema,
	/** How many times the name was logged in the searched period. */
	count: z.int().positive().optional(),
})

export type HistoryEntryFixture = z.infer<typeof historyEntrySchema>

export const evalCaseSchema = z
	.object({
		id: z.string().min(1),
		/** The words of the message; may be empty when the case has a photo. */
		text: z.string().default(''),
		/** A photo next to the words: a path relative to data/private/ (.jpg, .png or .webp). */
		image: z.string().min(1).optional(),
		/** A JSON case's gender forms of the user (Address form in the context); default neutral. */
		addressForm: addressFormSchema.optional(),
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
			/** Lower-case stems that must not start a word ("жим" catches «жиму», not «режим»). */
			replyExcludesWords: z.array(z.string().min(1)).optional(),
			/** The reply's language when the message's letters can't tell it (a Polish text without diacritics). */
			replyLang: replyLanguageSchema.optional(),
			edits: expectedEditsSchema.optional(),
			measurements: z.array(expectedMeasurementSchema).optional(),
			/** Exactly these log_workout calls; `[]` = none. */
			workouts: z.array(expectedWorkoutSchema).optional(),
			/** No log_workout may add to an open workout (appendRef); nothing else about workouts is judged. */
			noAppend: z.literal(true).optional(),
			/** The propose_program call. */
			program: expectedProgramSchema.optional(),
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
			/** The reply's attach: "program" = the program card is shown next to the text, null = no card. */
			replyAttach: z.literal('program').nullable().optional(),
			/** The show_stats call's advice flag (the user also asked for advice on the period). */
			statsAdvice: z.boolean().optional(),
			/**
			 * The period numbers the backend would send for the second call (the `{{period}}` of the tool
			 * result). With show_stats advice: true the runner makes that call and judges its reply too.
			 */
			statsNumbers: z.string().min(1).optional(),
			/** Exactly these earlier-entry refs (y1, h1) are copied by the logged items; [] = none copied. */
			copyRefs: z.array(z.string().regex(COPY_REF_PATTERN)).optional(),
			/**
			 * The copied refs must equal one of these sets; [] = nothing copied (e.g. a reply that only
			 * asks a question).
			 */
			copyRefsAnyOf: z
				.array(z.array(z.string().regex(COPY_REF_PATTERN)))
				.min(1)
				.optional(),
			/** Exactly these delete_measurement calls; `[]` = none. */
			deletedMeasurements: z.array(expectedDeletedMeasurementSchema).optional(),
			/** Every logged item must carry one of these sources (a label photo → LABEL, a plate → ESTIMATE). */
			sources: z.array(foodSourceSchema).min(1).optional(),
			/** The memory calls: save_food, save_fact, forget_fact. */
			memory: expectedMemorySchema.optional(),
			/** find_food must be called (true) or must not be (false). */
			findFoodCalled: z.boolean().optional(),
			/** Exactly these saved-food refs (m1, m11) are used by the logged items; [] = none. */
			memoryRefs: z.array(z.string().regex(MEMORY_REF_PATTERN)).optional(),
			/** Items logged from a saved food: its m-ref, source MEMORY and exactly these grams. */
			memoryItems: z
				.array(
					z.object({ ref: z.string().regex(MEMORY_REF_PATTERN), grams: z.number().positive() }),
				)
				.optional(),
		}),
		/** Earlier entries find_food can see (90 days before the case's today); a JSON case's own. */
		historyEntries: z.array(historyEntrySchema).optional(),
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
	/** How often the food was used: a small bonus of the search ranking. */
	usageCount: z.int().nonnegative().default(0),
})

export type SavedFood = z.infer<typeof savedFoodSchema>

export type EvalCase = z.infer<typeof evalCaseSchema> & {
	/** Day state the model sees; defaults to an empty day without a goal. */
	context?: CaseContext
	/**
	 * All the saved foods of the user: the passive «Saved foods» block takes those the message names
	 * (findMentionedFoods, like the backend) unless `context.memory` is set, and find_food searches them all.
	 */
	savedFoods?: SavedFood[]
	/** The loaded photo of a private case with `image`. */
	photo?: EvalPhoto
}
