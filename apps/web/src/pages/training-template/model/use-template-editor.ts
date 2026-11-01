import type { ProgramResponse, ProgramTemplateResponse } from '@kus/shared'
import { type Dispatch, useMemo, useReducer, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { getProgramActionError } from '@/features/accept-program-proposal'
import { useSaveProgramTemplate } from '@/features/save-program-template'
import { getApiError } from '@/shared/api'
import { getTrainingTemplatePath } from '@/shared/config'
import { useToast } from '@/shared/ui'

import { type TemplateDraftAction, templateDraftReducer } from '../lib/template-draft.reducer'
import { hasDraftChanges, toDraftExercises, toSaveExercises } from '../lib/template-draft'
import type { DraftExercise } from '../lib/template-draft.types'

const VERSION_CONFLICT = 'PROGRAM_VERSION_CONFLICT'

interface TemplateEditor {
	isEditing: boolean
	isSaving: boolean
	/** A template emptied by the edits is no workout: «Готово» waits for an exercise. */
	isDoneDisabled: boolean
	/** What the screen lists: the draft while editing, the saved template otherwise. */
	exercises: readonly DraftExercise[]
	dispatch: Dispatch<TemplateDraftAction>
	startEditing: () => void
	finishEditing: () => void
}

interface UseTemplateEditorOptions {
	program: ProgramResponse
	template: ProgramTemplateResponse
}

/**
 * The edits live here, in the page, and reach the server only with «Готово» — one new version of the
 * program, based on the version the editing started from. Leaving the page drops them.
 */
export const useTemplateEditor = ({
	program,
	template,
}: UseTemplateEditorOptions): TemplateEditor => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const toast = useToast()
	const save = useSaveProgramTemplate()
	const saved = useMemo(() => toDraftExercises(template), [template])
	const [draft, dispatch] = useReducer(templateDraftReducer, saved)
	const [baseVersionId, setBaseVersionId] = useState<string | null>(null)
	const isEditing = baseVersionId !== null

	const startEditing = (): void => {
		dispatch({ type: 'reset', exercises: saved })
		setBaseVersionId(program.version.id)
	}

	const finishEditing = (): void => {
		if (baseVersionId === null || save.isPending) return
		if (!hasDraftChanges(saved, draft)) {
			setBaseVersionId(null)
			return
		}
		save.mutate(
			{ baseVersionId, templateId: template.id, exercises: toSaveExercises(draft) },
			{
				onSuccess: (updated) => {
					setBaseVersionId(null)
					// every version has its own template rows: the same day (by key) has a new id
					const next = updated.templates.find((item) => item.key === template.key)
					if (next && next.id !== template.id) {
						void navigate(getTrainingTemplatePath(next.id), { replace: true })
					}
				},
				onError: (error) => {
					const apiError = getApiError(error)
					toast.show(getProgramActionError(apiError, t))
					// somebody changed the program meanwhile: the draft was made on the old one, so the
					// refreshed template is the truth
					if (apiError.kind === 'http' && apiError.errorCode === VERSION_CONFLICT) {
						setBaseVersionId(null)
					}
				},
			},
		)
	}

	return {
		isEditing,
		isSaving: save.isPending,
		isDoneDisabled: isEditing && draft.length === 0 && hasDraftChanges(saved, draft),
		exercises: isEditing ? draft : saved,
		dispatch,
		startEditing,
		finishEditing,
	}
}
