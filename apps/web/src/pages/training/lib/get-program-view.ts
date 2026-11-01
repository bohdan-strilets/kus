import type { ProgramResponse, ProgramTemplateResponse } from '@kus/shared'

/** The template the program points at; null when there is no pointer or it names no template. */
export const getNextTemplate = (program: ProgramResponse): ProgramTemplateResponse | null => {
	if (program.next === null) return null
	const { templateId } = program.next
	return program.templates.find((template) => template.id === templateId) ?? null
}
