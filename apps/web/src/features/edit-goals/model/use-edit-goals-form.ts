import { zodResolver } from '@hookform/resolvers/zod'
import type { ProfileGoals, SaveGoalsRequest } from '@kus/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type BaseSyntheticEvent, useMemo } from 'react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { goalsPreviewQueryOptions, invalidateGoalQueries } from '@/entities/goals'
import { getApiError } from '@/shared/api'
import { useToast } from '@/shared/ui'

import { putProfileGoals } from '../api/put-profile-goals'
import type { GoalValues } from '../lib/to-goal-values'
import {
	createEditGoalsSchema,
	type EditGoalsFormInput,
	type EditGoalsFormValues,
	getMacroMismatchText,
} from './edit-goals.schema'

const GOALS_INCONSISTENT_CODE = 'GOALS_INCONSISTENT'
const EMPTY_GOAL: EditGoalsFormInput = { kcal: '', protein: '', carbs: '', fat: '' }

/** The goal in force as the fields show it; none — empty fields. */
const toFormInput = (goal: GoalValues | null): EditGoalsFormInput =>
	goal
		? {
				kcal: String(Math.round(goal.kcal)),
				protein: String(Math.round(goal.protein)),
				carbs: String(Math.round(goal.carbs)),
				fat: String(Math.round(goal.fat)),
			}
		: EMPTY_GOAL

export interface CalculatedGoals {
	kcal: number
	proteinG: number
	carbsG: number
	fatG: number
}

export interface EditGoalsForm {
	form: UseFormReturn<EditGoalsFormInput, unknown, EditGoalsFormValues>
	onSubmit: (event?: BaseSyntheticEvent) => Promise<void>
	restoreCalculated: () => void
	/** What the profile data gives; null while loading or when the profile is incomplete. */
	calculated: CalculatedGoals | null
	isSaving: boolean
	isRestoring: boolean
}

/** Validates on the go; saves the typed goal or the calculated one, refreshes the day and closes. */
export const useEditGoalsForm = ({
	goal,
	isOpen,
	onSaved,
}: {
	goal: GoalValues | null
	isOpen: boolean
	onSaved: () => void
}): EditGoalsForm => {
	const { t } = useTranslation()
	const toast = useToast()
	const queryClient = useQueryClient()
	const schema = useMemo(() => createEditGoalsSchema(t), [t])
	const form = useForm<EditGoalsFormInput, unknown, EditGoalsFormValues>({
		resolver: zodResolver(schema),
		defaultValues: toFormInput(goal),
		mode: 'onChange',
	})
	// pending, a failure or 409 (profile incomplete) leave data undefined: no «розраховано»
	const preview = useQuery({ ...goalsPreviewQueryOptions, enabled: isOpen })
	const calculated: CalculatedGoals | null = preview.data
		? {
				kcal: preview.data.kcal,
				proteinG: preview.data.proteinG,
				carbsG: preview.data.carbsG,
				fatG: preview.data.fatG,
			}
		: null

	const handleError = (error: unknown, request: SaveGoalsRequest): void => {
		const apiError = getApiError(error)
		if (apiError.kind === 'http' && apiError.errorCode === GOALS_INCONSISTENT_CODE) {
			const { macroKcal } = apiError.details
			if (typeof macroKcal === 'number' && typeof request.kcal === 'number') {
				form.setError('macros', {
					message: getMacroMismatchText(t, { macroKcal, kcal: request.kcal }),
				})
				return
			}
		}
		toast.show(t('goal.saveError'))
	}
	const handleSuccess = async (_goals: ProfileGoals): Promise<void> => {
		await invalidateGoalQueries(queryClient)
		onSaved()
	}
	const manualMutation = useMutation({
		mutationFn: putProfileGoals,
		onSuccess: handleSuccess,
		onError: handleError,
	})
	const calculatedMutation = useMutation({
		mutationFn: putProfileGoals,
		onSuccess: handleSuccess,
		onError: handleError,
	})

	return {
		form,
		// a failed save shows a toast or the macros error; the fields stay as typed for another try
		onSubmit: form.handleSubmit((values) => {
			manualMutation.mutate({
				source: 'manual',
				kcal: values.kcal,
				proteinG: values.protein,
				carbsG: values.carbs,
				fatG: values.fat,
			})
		}),
		restoreCalculated: () => {
			calculatedMutation.mutate({ source: 'calculated' })
		},
		calculated,
		isSaving: manualMutation.isPending,
		isRestoring: calculatedMutation.isPending,
	}
}
