import { z } from 'zod'

import { CLARIFY_OPTIONS } from '../ai/tools.js'

export const clarificationParamsSchema = z.object({ id: z.uuid() })

export type ClarificationParams = z.infer<typeof clarificationParamsSchema>

/** Body of POST /clarifications/:id/answer — a tap on one of the options, no model involved. */
export const answerClarificationRequestSchema = z.object({
	optionIndex: z
		.int()
		.nonnegative()
		.max(CLARIFY_OPTIONS.max - 1),
})

export type AnswerClarificationRequest = z.infer<typeof answerClarificationRequestSchema>
