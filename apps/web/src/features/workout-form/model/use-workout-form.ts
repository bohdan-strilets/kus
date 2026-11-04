import { zodResolver } from '@hookform/resolvers/zod'
import type { ProgramTemplateResponse, WorkoutFinished } from '@kus/shared'
import { type BaseSyntheticEvent, useMemo, useState } from 'react'
import {
	useFieldArray,
	useForm,
	type UseFieldArrayReturn,
	type UseFormReturn,
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { getLiveActionError, useLiveWorkoutActions } from '@/entities/workout'
import { getApiError } from '@/shared/api'
import { createUuid } from '@/shared/lib'
import { useToast } from '@/shared/ui'

import { getDefaultStartTime } from '../lib/get-default-start-time'
import { buildFormDraft } from '../lib/build-form-draft'
import { buildFormPayload } from '../lib/build-form-payload'
import type { FormNow, WorkoutFormValues } from '../lib/workout-form.types'
import { createWorkoutFormSchema } from './workout-form.schema'

/** Server field → the message of the form's own field (the same words the schema uses). */
const SERVER_FIELD_MESSAGES = {
	localDate: 'training.form.validation.dateOutOfRange',
	startTime: 'training.form.validation.startInFuture',
	exercises: 'training.form.pickOne',
} as const

type ServerField = keyof typeof SERVER_FIELD_MESSAGES

const isServerField = (field: string): field is ServerField => field in SERVER_FIELD_MESSAGES

export interface UseWorkoutForm {
	form: UseFormReturn<WorkoutFormValues>
	/** The exercises of the form: `update(index, …)` for an edited one, `append` for «+ Вправа». */
	exercises: UseFieldArrayReturn<WorkoutFormValues, 'exercises'>
	/** An exercise the person added leaves the form; «Скасувати» in the toast puts it back. */
	removeExercise: (index: number) => void
	/** The duration field changed: until the start is edited by hand, it moves to end at «now». */
	changeDuration: (durationMin: number | null) => void
	/** «Готово» of the «Коли» sheet: the day and the start are the person's own from now on. */
	applyWhen: (value: { localDate: string; startTime: string }) => void
	/** Never disabled: pressing «Зберегти» shows every error at once. */
	onSubmit: (event?: BaseSyntheticEvent) => Promise<void>
	isSaving: boolean
	/** The summary the server wrote; null until the form is saved. */
	finished: WorkoutFinished | null
}

/**
 * The form «Заповнити»: the plan of the template filled in, edited by deviations, saved as one
 * finished session. Validates on the go; the request id is made once per form, so a repeated
 * «Зберегти» (a lost answer) returns the first result instead of a second training.
 */
export const useWorkoutForm = ({
	template,
	now,
}: {
	/** null: an empty session. */
	template: ProgramTemplateResponse | null
	now: FormNow
}): UseWorkoutForm => {
	const { t } = useTranslation()
	const toast = useToast()
	const { saveForm } = useLiveWorkoutActions()
	const [clientRequestId] = useState(createUuid)
	const [finished, setFinished] = useState<WorkoutFinished | null>(null)
	const [isStartEdited, setIsStartEdited] = useState(false)
	const { localDate, time } = now
	const schema = useMemo(
		() => createWorkoutFormSchema(t, { localDate, time }),
		[t, localDate, time],
	)
	const [defaultValues] = useState(() => buildFormDraft(template, { now }))
	const form = useForm<WorkoutFormValues>({
		resolver: zodResolver(schema),
		defaultValues,
		mode: 'onChange',
	})
	const exercises = useFieldArray({ control: form.control, name: 'exercises' })

	const changeDuration = (durationMin: number | null): void => {
		form.setValue('durationMin', durationMin, { shouldValidate: true, shouldDirty: true })
		// a backdated day keeps the time chosen for it
		if (isStartEdited || form.getValues('localDate') !== localDate) return
		form.setValue('startTime', getDefaultStartTime(time, durationMin), { shouldValidate: true })
	}

	const applyWhen = (value: { localDate: string; startTime: string }): void => {
		setIsStartEdited(true)
		form.setValue('localDate', value.localDate, { shouldValidate: true, shouldDirty: true })
		form.setValue('startTime', value.startTime, { shouldValidate: true, shouldDirty: true })
	}

	const removeExercise = (index: number): void => {
		const removed = form.getValues('exercises')[index]
		if (!removed) return
		exercises.remove(index)
		toast.show(t('workout.exerciseDeleted'), {
			action: {
				label: t('workout.undo'),
				onClick: () => {
					exercises.insert(Math.min(index, form.getValues('exercises').length), removed)
				},
			},
		})
	}

	const handleServerError = (error: unknown): void => {
		const apiError = getApiError(error)
		const fields = apiError.kind === 'http' ? apiError.details.fields : undefined
		const serverFields =
			fields && typeof fields === 'object' ? Object.keys(fields).filter(isServerField) : []
		if (serverFields.length === 0) {
			toast.show(getLiveActionError(apiError, t))
			return
		}
		serverFields.forEach((field) => {
			form.setError(field, { message: t(SERVER_FIELD_MESSAGES[field]) })
		})
	}

	const onSubmit = form.handleSubmit(async (values) => {
		const payload = buildFormPayload({
			values,
			clientRequestId,
			templateId: template?.id ?? null,
		})
		try {
			setFinished(await saveForm.mutateAsync(payload))
		} catch (error) {
			handleServerError(error)
		}
	})

	return {
		form,
		exercises,
		removeExercise,
		changeDuration,
		applyWhen,
		onSubmit,
		isSaving: saveForm.isPending,
		finished,
	}
}
