import { zodResolver } from '@hookform/resolvers/zod'
import type { DailyGoal } from '@kus/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type BaseSyntheticEvent, useMemo } from 'react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { DAY_QUERY_KEY } from '@/entities/day'
import { useToast } from '@/shared/ui'

import { putCurrentGoal } from '../api/put-goal'
import {
	createSetGoalSchema,
	type SetGoalFormInput,
	type SetGoalFormValues,
} from './set-goal.schema'

const EMPTY_GOAL: SetGoalFormInput = { kcal: '', protein: '', carbs: '', fat: '' }

/** The goal in force as the fields show it; none — empty fields. */
const toFormInput = (goal: DailyGoal | null): SetGoalFormInput =>
	goal
		? {
				kcal: String(Math.round(goal.kcal)),
				protein: String(Math.round(goal.protein)),
				carbs: String(Math.round(goal.carbs)),
				fat: String(Math.round(goal.fat)),
			}
		: EMPTY_GOAL

export interface SetGoalForm {
	form: UseFormReturn<SetGoalFormInput, unknown, SetGoalFormValues>
	onSubmit: (event?: BaseSyntheticEvent) => Promise<void>
	isSaving: boolean
}

/** Validates on the go, saves, refreshes the day (the ring and the «Сьогодні» tab) and closes. */
export const useSetGoalForm = ({
	goal,
	onSaved,
}: {
	goal: DailyGoal | null
	onSaved: () => void
}): SetGoalForm => {
	const { t } = useTranslation()
	const toast = useToast()
	const queryClient = useQueryClient()
	const schema = useMemo(() => createSetGoalSchema(t), [t])
	const form = useForm<SetGoalFormInput, unknown, SetGoalFormValues>({
		resolver: zodResolver(schema),
		defaultValues: toFormInput(goal),
		mode: 'onChange',
	})
	const mutation = useMutation({
		mutationFn: putCurrentGoal,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: DAY_QUERY_KEY })
			onSaved()
		},
		onError: () => {
			toast.show(t('goal.saveError'))
		},
	})

	return {
		form,
		// a failed save shows a toast (onError); the form stays as typed for another try
		onSubmit: form.handleSubmit((values) => {
			mutation.mutate(values)
		}),
		isSaving: mutation.isPending,
	}
}
