import type { DailyGoal } from '@kus/shared'
import type { TFunction } from 'i18next'
import { Controller, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { formatInteger } from '@/shared/lib'
import { Button, FormField, Input, Text } from '@/shared/ui'

import { getMacroMismatch } from '../lib/get-macro-mismatch'
import { getGoalRangeTexts, type SetGoalFormInput } from '../model/set-goal.schema'
import { useSetGoalForm } from '../model/use-set-goal-form'

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

interface SetGoalFormProps {
	/** The goal in force: the fields start from it; null — empty fields. */
	goal: DailyGoal | null
	onSaved: () => void
}

/** Mounted with each opening of the sheet, so the fields always start from the current goal. */
export const SetGoalForm = ({ goal, onSaved }: SetGoalFormProps) => {
	const { t } = useTranslation()
	const { form, onSubmit, isSaving } = useSetGoalForm({ goal, onSaved })
	const { errors, submitCount } = form.formState
	const mismatch = getMacroMismatch(useWatch({ control: form.control }))

	return (
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
			{mismatch && (
				<Text as="p" variant="caption" tone="mutedStrong" role="status">
					{t(mismatch.deltaPct > 0 ? 'goal.macroMismatchMore' : 'goal.macroMismatchLess', {
						macroKcal: formatInteger(mismatch.macroKcal),
						delta: Math.abs(mismatch.deltaPct),
					})}
				</Text>
			)}
			<Button type="submit" isFullWidth isLoading={isSaving}>
				{t('goal.save')}
			</Button>
		</form>
	)
}
