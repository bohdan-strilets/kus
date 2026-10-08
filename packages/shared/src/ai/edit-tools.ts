// Tools that change what is already logged today: the model points at entries and questions by the
// refs of the context (`e3`, `c1`), the backend maps them to rows of this user only.
// After any change here: run `pnpm --filter ai-eval eval` and add a line to PROMPT_CHANGELOG.md.
import { z } from 'zod'

import { foodEntryBaseSchema } from '../schemas/food-entry.js'

/** Refs the backend gives today's entries and open questions in the context, never database ids. */
export const ENTRY_REF_PATTERN = /^e\d{1,3}$/
export const CLARIFICATION_REF_PATTERN = /^c\d{1,2}$/

/** One message never touches more entries than it could log. */
export const MAX_EDITS_PER_MESSAGE = 20
const ANSWER_MAX_LENGTH = 60

const entryRefSchema = z
	.string()
	.regex(ENTRY_REF_PATTERN)
	.describe('Ref of an entry from "Today\'s entries" in the context, e.g. "e3"')

const entryRefsSchema = z
	.array(entryRefSchema)
	.min(1)
	.max(MAX_EDITS_PER_MESSAGE)
	.refine((refs) => new Set(refs).size === refs.length, { message: 'refs must not repeat' })

/** Whole-portion values, judged like a logged item (density, kcal vs macros). */
const portionValuesSchema = z.object({
	kcal: foodEntryBaseSchema.shape.kcal.describe('Energy of the whole portion, kcal'),
	protein: foodEntryBaseSchema.shape.protein.describe('Protein of the whole portion, g'),
	fat: foodEntryBaseSchema.shape.fat.describe('Fat of the whole portion, g'),
	carbs: foodEntryBaseSchema.shape.carbs.describe(
		'Carbohydrates of the whole portion excluding fiber, g',
	),
	fiber: foodEntryBaseSchema.shape.fiber.describe('Fiber of the whole portion, g; null if unknown'),
})

export type PortionValues = z.infer<typeof portionValuesSchema>

export const entryChangeSchema = z
	.object({
		ref: entryRefSchema,
		name: foodEntryBaseSchema.shape.name
			.nullable()
			.default(null)
			.describe(
				'New name only if the food itself is different ("Суп курячий" instead of "Борщ"); else null',
			),
		category: foodEntryBaseSchema.shape.category
			.nullable()
			.default(null)
			.describe('New category only together with a new name; else null'),
		grams: foodEntryBaseSchema.shape.grams
			.nullable()
			.default(null)
			.describe(
				'New weight of the whole portion. With values null the backend rescales kcal and macros from the entry; else null',
			),
		values: portionValuesSchema
			.nullable()
			.default(null)
			.describe(
				'New values of the whole portion — only when the user gives numbers or the food itself is different; else null',
			),
	})
	.refine(
		(change) => [change.name, change.category, change.grams, change.values].some((v) => v !== null),
		{
			message: 'change at least one of name, category, grams or values',
		},
	)

export type EntryChange = z.infer<typeof entryChangeSchema>

export const correctEntryInputSchema = z.object({
	changes: z.array(entryChangeSchema).min(1).max(MAX_EDITS_PER_MESSAGE),
})

export type CorrectEntryInput = z.infer<typeof correctEntryInputSchema>

export const deleteEntryInputSchema = z.object({ refs: entryRefsSchema })

export type DeleteEntryInput = z.infer<typeof deleteEntryInputSchema>

export const restoreEntryInputSchema = z.object({
	refs: z
		.array(entryRefSchema.describe('Ref of an entry from "Deleted today" in the context'))
		.min(1)
		.max(MAX_EDITS_PER_MESSAGE)
		.refine((refs) => new Set(refs).size === refs.length, { message: 'refs must not repeat' }),
})

export type RestoreEntryInput = z.infer<typeof restoreEntryInputSchema>

export const resolveClarificationInputSchema = z
	.object({
		ref: z
			.string()
			.regex(CLARIFICATION_REF_PATTERN)
			.describe('Ref of a question from "Open questions" in the context, e.g. "c1"'),
		answer: z
			.string()
			.trim()
			.min(1)
			.max(ANSWER_MAX_LENGTH)
			.describe('The user\'s answer in a few of their words ("трішки жирна")'),
		optionIndex: z
			.int()
			.nonnegative()
			.nullable()
			.default(null)
			.describe('0-based option the answer matches; else null'),
		values: portionValuesSchema
			.extend({
				grams: foodEntryBaseSchema.shape.grams
					.nullable()
					.default(null)
					.describe('Total grams only if the answer changes the portion weight; else null'),
			})
			.nullable()
			.default(null)
			.describe(
				"Totals of the question's entries for an answer between two options (kcal between the options' kcal); else null",
			),
	})
	.refine((input) => input.optionIndex === null || input.values === null, {
		message: 'set optionIndex or values, not both',
	})

export type ResolveClarificationInput = z.infer<typeof resolveClarificationInputSchema>

/** Everything a turn changes in what was logged before it. */
export interface EntryEdits {
	corrections: EntryChange[]
	deletions: string[]
	restorations: string[]
	resolutions: ResolveClarificationInput[]
}

export const EMPTY_EDITS: EntryEdits = {
	corrections: [],
	deletions: [],
	restorations: [],
	resolutions: [],
}

export const hasEdits = (edits: EntryEdits): boolean =>
	edits.corrections.length +
		edits.deletions.length +
		edits.restorations.length +
		edits.resolutions.length >
	0
