import { zodResolver } from '@hookform/resolvers/zod'
import {
	getDefaultTemplateName,
	type ProgramResponse,
	type ProgramTemplateResponse,
} from '@kus/shared'
import { type Dispatch, useMemo, useReducer, useState } from 'react'
import { useForm, type UseFormReturn, useWatch } from 'react-hook-form'
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
import {
	createTemplateNameSchema,
	resolveTemplateName,
	type TemplateNameFormValues,
} from '../lib/template-name'

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
	/** The first field of the editor, «Назва тренування». */
	nameForm: UseFormReturn<TemplateNameFormValues>
	/** Empty while the name is as saved: an old long name is no mistake until it is touched. */
	nameError: string | undefined
	defaultName: string
	restoreDefaultName: () => void
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
	const nameSchema = useMemo(() => createTemplateNameSchema(t), [t])
	const nameForm = useForm<TemplateNameFormValues>({
		resolver: zodResolver(nameSchema),
		defaultValues: { name: template.name },
		mode: 'onChange',
	})
	const typedName = useWatch({ control: nameForm.control, name: 'name' })
	const defaultName = getDefaultTemplateName(template.position)
	const [baseVersionId, setBaseVersionId] = useState<string | null>(null)
	const isEditing = baseVersionId !== null

	const startEditing = (): void => {
		dispatch({ type: 'reset', exercises: saved })
		nameForm.reset({ name: template.name })
		setBaseVersionId(program.version.id)
	}

	const finishEditing = (): void => {
		if (baseVersionId === null || save.isPending) return
		const outcome = resolveTemplateName({
			typed: nameForm.getValues('name'),
			saved: template.name,
			position: template.position,
		})
		if (outcome.status === 'invalid') {
			void nameForm.trigger('name')
			return
		}
		// only a changed name goes to the server
		const newName = outcome.status === 'rename' ? outcome.name : null
		if (!hasDraftChanges(saved, draft, newName)) {
			setBaseVersionId(null)
			return
		}
		save.mutate(
			{
				baseVersionId,
				templateId: template.id,
				exercises: toSaveExercises(draft),
				...(newName === null ? {} : { name: newName }),
			},
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
					// somebody changed the program meanwhile: the draft was made on the old one, so the
					// refreshed template is the truth (the chat card's «перерахуй» does not fit here)
					if (apiError.kind === 'http' && apiError.errorCode === VERSION_CONFLICT) {
						toast.show(t('program.editor.conflict'))
						setBaseVersionId(null)
						return
					}
					toast.show(getProgramActionError(apiError, t))
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
		nameForm,
		nameError:
			typedName.trim() === template.name ? undefined : nameForm.formState.errors.name?.message,
		defaultName,
		restoreDefaultName: () => {
			nameForm.setValue('name', defaultName, { shouldValidate: true })
		},
	}
}
