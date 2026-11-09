import {
	getDefaultTemplateName,
	PROGRAM_TEMPLATE_NAME_COUNTER_FROM,
	PROGRAM_TEMPLATE_NAME_UI_MAX,
} from '@kus/shared'
import type { TFunction } from 'i18next'
import { z } from 'zod'

export const createTemplateNameSchema = (t: TFunction) =>
	z.object({
		name: z
			.string()
			.trim()
			.max(
				PROGRAM_TEMPLATE_NAME_UI_MAX,
				t('program.editor.nameTooLong', { max: PROGRAM_TEMPLATE_NAME_UI_MAX }),
			),
	})

export type TemplateNameFormValues = z.infer<ReturnType<typeof createTemplateNameSchema>>

export type TemplateNameOutcome =
	{ status: 'unchanged' } | { status: 'invalid' } | { status: 'rename'; name: string }

interface ResolveTemplateNameOptions {
	typed: string
	/** The name the template has now. */
	saved: string
	/** 0-based `position` of the template: an empty field falls back to its «Тренування А». */
	position: number
}

/**
 * What «Готово» does with the field. An untouched name passes whatever its length (an AI-made name
 * may be longer than the field allows); a changed one must fit; an emptied one is the default.
 */
export const resolveTemplateName = ({
	typed,
	saved,
	position,
}: ResolveTemplateNameOptions): TemplateNameOutcome => {
	const trimmed = typed.trim()
	if (trimmed === saved) return { status: 'unchanged' }
	if (trimmed === '') {
		const fallback = getDefaultTemplateName(position)
		return fallback === saved ? { status: 'unchanged' } : { status: 'rename', name: fallback }
	}
	if (trimmed.length > PROGRAM_TEMPLATE_NAME_UI_MAX) return { status: 'invalid' }
	return { status: 'rename', name: trimmed }
}

export const isTemplateNameCounterShown = (typed: string): boolean =>
	typed.length >= PROGRAM_TEMPLATE_NAME_COUNTER_FROM
