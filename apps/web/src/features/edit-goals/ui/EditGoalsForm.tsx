import type { ParseKeys } from 'i18next'
import { Controller, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { formatInteger } from '@/shared/lib'
import { Button, Icon, ICON_SIZE } from '@/shared/ui'

import { getMacroHint } from '../lib/get-macro-hint'
import type { GoalValues } from '../lib/to-goal-values'
import type { EditGoalsFormInput } from '../model/edit-goals.schema'
import { type CalculatedGoals, useEditGoalsForm } from '../model/use-edit-goals-form'
import type { GoalTileTone } from './goal-tile-field.variants'
import { GoalTileField } from './GoalTileField'
import { MacroKcalHint } from './MacroKcalHint'

interface TileField {
	name: Exclude<keyof EditGoalsFormInput, 'macros'>
	tone: GoalTileTone
	labelKey: ParseKeys
	getCalculated: (calculated: CalculatedGoals) => number
}

/** Kcal first, then the macros in the fixed order Б → В → Ж (CLAUDE.md §3). */
const FIELDS: TileField[] = [
	{ name: 'kcal', tone: 'kcal', labelKey: 'profile.goals.kcal', getCalculated: (c) => c.kcal },
	{
		name: 'protein',
		tone: 'protein',
		labelKey: 'profile.goals.protein',
		getCalculated: (c) => c.proteinG,
	},
	{
		name: 'carbs',
		tone: 'carbs',
		labelKey: 'profile.goals.carbs',
		getCalculated: (c) => c.carbsG,
	},
	{ name: 'fat', tone: 'fat', labelKey: 'profile.goals.fat', getCalculated: (c) => c.fatG },
]

interface EditGoalsFormProps {
	/** The goal in force: the fields start from it; null — empty fields. */
	goal: GoalValues | null
	onSaved: () => void
}

/** Mounted with each opening of the sheet, so the fields always start from the current goal. */
export const EditGoalsForm = ({ goal, onSaved }: EditGoalsFormProps) => {
	const { t } = useTranslation()
	const { form, onSubmit, restoreCalculated, calculated, isSaving, isRestoring } = useEditGoalsForm(
		{ goal, isOpen: true, onSaved },
	)
	const { errors, submitCount } = form.formState
	const hint = getMacroHint(useWatch({ control: form.control }))

	return (
		<form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-3.5">
			<div className="grid grid-cols-2 gap-2">
				{FIELDS.map((field) => (
					<Controller
						key={field.name}
						control={form.control}
						name={field.name}
						render={({ field: control }) => (
							<GoalTileField
								tone={field.tone}
								label={t(field.labelKey)}
								value={control.value}
								onChange={control.onChange}
								onBlur={control.onBlur}
								name={control.name}
								calculatedText={
									calculated
										? t('editGoals.calculated', {
												value: formatInteger(field.getCalculated(calculated)),
											})
										: null
								}
								error={errors[field.name]?.message}
								attemptCount={submitCount}
							/>
						)}
					/>
				))}
			</div>
			<MacroKcalHint hint={hint} errorMessage={errors.macros?.message} />
			<div className="flex flex-col gap-1">
				<Button type="submit" isFullWidth isLoading={isSaving}>
					{t('editGoals.save')}
				</Button>
				{calculated && (
					<Button
						variant="text"
						isFullWidth
						isLoading={isRestoring}
						icon={<Icon name="retry" size={ICON_SIZE.control} />}
						onClick={restoreCalculated}
						// the mockup's link has no underline, unlike the `text` variant
						className="no-underline"
					>
						{t('editGoals.restoreCalculated')}
					</Button>
				)}
			</div>
		</form>
	)
}
