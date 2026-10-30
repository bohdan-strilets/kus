import { z } from 'zod'

import { getFactTextIssue } from '../ai/fact-guard.js'
import { factCategorySchema, factStatusSchema } from './enums.js'

/** One sentence (design/mockups/memory-facts.html). */
export const FACT_TEXT_MAX_LENGTH = 120
/** Confirmed facts per user; a proposal waiting for «Так / Ні» is not counted. */
export const FACTS_MAX = 30

/**
 * A fact as it is stored: one line (line breaks and runs of spaces collapse, so a fact can't fake
 * a new line of the model context), at most 120 characters, and none of the fact-guard issues.
 */
export const factTextSchema = z
	.string()
	.transform((text) => text.replace(/\s+/g, ' ').trim())
	.pipe(
		z
			.string()
			.min(1)
			.max(FACT_TEXT_MAX_LENGTH)
			.superRefine((text, context) => {
				const issue = getFactTextIssue(text)
				if (issue !== null) context.addIssue({ code: 'custom', message: issue })
			}),
	)

/** One fact as «Пам'ять · Про тебе» shows it; every fact comes from the chat («з чату, 12 жовтня»). */
export const factResponseSchema = z.object({
	id: z.uuid(),
	text: z.string(),
	category: factCategorySchema,
	status: factStatusSchema,
	createdAt: z.iso.datetime(),
})

export type FactResponse = z.infer<typeof factResponseSchema>

/** `:id` of /facts/:id routes. */
export const factParamsSchema = z.object({ id: z.uuid() })

export type FactParams = z.infer<typeof factParamsSchema>

/** Body of PATCH /facts/:id — the fact sheet edits the text only. */
export const updateFactRequestSchema = z.object({ text: factTextSchema })

export type UpdateFactRequest = z.infer<typeof updateFactRequestSchema>

/** Body of POST /facts/:id/answer — «Так» / «Ні» on a proposal in the chat. */
export const answerFactRequestSchema = z.object({ accept: z.boolean() })

export type AnswerFactRequest = z.infer<typeof answerFactRequestSchema>
