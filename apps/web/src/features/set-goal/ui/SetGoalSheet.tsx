import type { TFunction } from 'i18next'
import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { BaseBottomSheet, Button, FormField, Input } from '@/shared/ui'

import { getGoalRangeTexts, type SetGoalFormInput } from '../model/set-goal.schema'
import { useSetGoalForm } from '../model/use-set-goal-form'

interface SetGoalSheetProps {
	isOpen: boolean
	onOpenChange: (isOpen: boolean) => void
}

/** Kcal first, then the macros in the fixed order Б → В → Ж (CLAUDE.md §3). */
const getFields = (
	t: TFunction,
): { name: keyof SetGoalFormInput; label: string; hint: string }[] => {
	const ranges = getGoalRangeTexts(t)
	return [
		{ name: 'kcal', label: t('goal.kcal'), hint: ranges.kcal },
		{ name: 'protein', label: t('goal.protein'), hint: ranges.macro },
		{ name: 'carbs', label: t('goal.carbs'), hint: ranges.macro },
		{ name: 'fat', label: t('goal.fat'), hint: ranges.macro },
	]
}

/** The day's kcal and macros; saved from today on, the chat ring fills from it. */
export const SetGoalSheet = ({ isOpen, onOpenChange }: SetGoalSheetProps) => {
	const { t } = useTranslation()
	const { form, onSubmit, isSaving } = useSetGoalForm({
		onSaved: () => {
			onOpenChange(false)
		},
	})
	const { errors, submitCount } = form.formState

	return (
		<BaseBottomSheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={t('goal.title')}
			description={t('goal.description')}
		>
			<form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-3">
				{getFields(t).map((field) => (
					<Controller
						key={field.name}
						control={form.control}
						name={field.name}
						render={({ field: control }) => (
							<FormField
								label={field.label}
								hint={field.hint}
								error={errors[field.name]?.message}
								attemptCount={submitCount}
							>
								{(controlProps) => (
									<Input {...control} {...controlProps} inputMode="numeric" autoComplete="off" />
								)}
							</FormField>
						)}
					/>
				))}
				<Button type="submit" isFullWidth isLoading={isSaving}>
					{t('goal.save')}
				</Button>
			</form>
		</BaseBottomSheet>
	)
}
