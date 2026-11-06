import type { ProgramDraft, ProgramTemplateDraft } from '@kus/shared'

export interface ShownTemplates {
	templates: ProgramTemplateDraft[]
	otherCount: number
}

/** SINGLE with a pinned template shows only that one; everything else shows the whole program. */
export const getShownTemplates = (
	program: Pick<ProgramDraft, 'mode' | 'pinnedKey' | 'templates'>,
): ShownTemplates => {
	const pinned =
		program.mode === 'SINGLE'
			? program.templates.find((template) => template.key === program.pinnedKey)
			: undefined
	if (!pinned) return { templates: program.templates, otherCount: 0 }
	return { templates: [pinned], otherCount: program.templates.length - 1 }
}
