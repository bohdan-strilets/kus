import { zodResolver } from '@hookform/resolvers/zod'
import type { FoodEntryResponse, LoggedMeal } from '@kus/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type BaseSyntheticEvent, useMemo } from 'react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { DAY_QUERY_KEY } from '@/entities/day'
import { MESSAGES_QUERY_KEY } from '@/entities/message'
import { getApiError } from '@/shared/api'
import { useToast } from '@/shared/ui'

import { deleteFoodEntry } from '../api/delete-food-entry'
import { patchFoodEntry } from '../api/patch-food-entry'
import { getAmountUnit } from '../lib/get-amount-unit'
import { getEditErrorKey } from '../lib/get-edit-error-key'
import {
	createEditEntrySchema,
	type EditEntryFormInput,
	type EditEntryFormValues,
} from './edit-entry.schema'

export interface EditEntryForm {
	form: UseFormReturn<EditEntryFormInput, unknown, EditEntryFormValues>
	onSubmit: (event?: BaseSyntheticEvent) => Promise<void>
	isSaving: boolean
	/** After the confirmation: soft-deletes the entry and closes. */
	remove: () => void
	isDeleting: boolean
}

/** The chip the sheet starts on; a meal of type OTHER (never logged by the chat) has none. */
const toInitialMealType = (type: LoggedMeal['type']): EditEntryFormInput['mealType'] | undefined =>
	type === 'OTHER' ? undefined : type

interface UseEditEntryFormParams {
	entry: FoodEntryResponse
	/** The meal the entry is in: its type is the chip the sheet starts on. */
	meal: LoggedMeal
	onDone: () => void
}

/**
 * Validates on the go, sends only what changed, refreshes the day and the chat (every card of
 * the meal shows «· змінено» and the new kcal) and closes.
 */
export const useEditEntryForm = ({
	entry,
	meal,
	onDone,
}: UseEditEntryFormParams): EditEntryForm => {
	const { t } = useTranslation()
	const toast = useToast()
	const queryClient = useQueryClient()
	const unit = getAmountUnit(entry.category)
	const schema = useMemo(() => createEditEntrySchema(t, { unit }), [t, unit])
	const initialGrams = Math.round(entry.grams)
	const initialMealType = toInitialMealType(meal.type)
	const form = useForm<EditEntryFormInput, unknown, EditEntryFormValues>({
		resolver: zodResolver(schema),
		defaultValues: { grams: String(initialGrams), mealType: initialMealType },
		mode: 'onChange',
	})

	// the day (totals, the list) and every chat card of the meal show the change; after a failure
	// the screen shows the real state too (the entry may be gone)
	const refresh = (): void => {
		void queryClient.invalidateQueries({ queryKey: DAY_QUERY_KEY })
		void queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY })
	}
	const handleError = (error: unknown, action: 'save' | 'delete'): void => {
		const apiError = getApiError(error)
		toast.show(t(getEditErrorKey(apiError, action)))
		refresh()
		// deleted elsewhere meanwhile: there is nothing left to edit
		if (apiError.kind === 'http' && apiError.errorCode === 'ENTRY_NOT_FOUND') onDone()
	}
	const update = useMutation({
		mutationFn: patchFoodEntry,
		onSuccess: () => {
			refresh()
			onDone()
		},
		onError: (error) => {
			handleError(error, 'save')
		},
	})
	const removal = useMutation({
		mutationFn: deleteFoodEntry,
		onSuccess: () => {
			refresh()
			onDone()
		},
		onError: (error) => {
			handleError(error, 'delete')
		},
	})

	return {
		form,
		onSubmit: form.handleSubmit((values) => {
			const body = {
				...(values.grams === initialGrams ? {} : { grams: values.grams }),
				...(values.mealType === initialMealType ? {} : { mealType: values.mealType }),
			}
			// nothing changed: close without a request
			if (body.grams === undefined && body.mealType === undefined) {
				onDone()
				return
			}
			update.mutate({ id: entry.id, ...body })
		}),
		isSaving: update.isPending,
		remove: () => {
			if (!removal.isPending) removal.mutate(entry.id)
		},
		isDeleting: removal.isPending,
	}
}
