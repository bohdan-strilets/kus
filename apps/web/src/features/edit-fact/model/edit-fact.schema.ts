import { FACT_TEXT_MAX_LENGTH, type FactTextIssue, getFactTextIssue } from '@kus/shared'
import type { TFunction } from 'i18next'
import { z } from 'zod'

const WHITESPACE = /\s+/g

/** What can be wrong with the text: the fact-guard issues, the length codes of a 422 and a duplicate. */
export type FactFieldCode = FactTextIssue | 'TOO_SMALL' | 'TOO_LARGE' | 'FACT_EXISTS'

export const getFactFieldMessage = (code: FactFieldCode, t: TFunction): string => {
	switch (code) {
		case 'TOO_SMALL':
			return t('editFact.validation.required')
		case 'TOO_LARGE':
			return t('editFact.validation.tooLong', { count: FACT_TEXT_MAX_LENGTH })
		case 'FACT_EXISTS':
			return t('errors.api.FACT_EXISTS')
		case 'HEALTH_DATA':
			return t('editFact.validation.HEALTH_DATA')
		case 'BODY_DATA':
			return t('editFact.validation.BODY_DATA')
		case 'INSTRUCTION':
			return t('editFact.validation.INSTRUCTION')
	}
}

/** The same rules as the server's factTextSchema, with texts: one line, 1–120 characters, no guard issue. */
export const createEditFactSchema = (t: TFunction) =>
	z.object({
		text: z
			.string()
			.transform((text) => text.replace(WHITESPACE, ' ').trim())
			.pipe(
				z
					.string()
					.min(1, getFactFieldMessage('TOO_SMALL', t))
					.max(FACT_TEXT_MAX_LENGTH, getFactFieldMessage('TOO_LARGE', t))
					.superRefine((text, context) => {
						const issue = getFactTextIssue(text)
						if (issue !== null) {
							context.addIssue({ code: 'custom', message: getFactFieldMessage(issue, t) })
						}
					}),
			),
	})

export type EditFactInput = z.input<ReturnType<typeof createEditFactSchema>>
export type EditFactValues = z.output<ReturnType<typeof createEditFactSchema>>
