import type { FoodEntryResponse, LoggedMeal } from '@kus/shared'
import { useId, useState } from 'react'
import { Controller, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { formatEntryAmount } from '@/entities/entry'
import { formatInteger } from '@/shared/lib'
import { Button, ConfirmDialog, FoodIcon, Surface, Text } from '@/shared/ui'

import { getAmountUnit } from '../lib/get-amount-unit'
import { parseAmount } from '../lib/parse-amount'
import { getScaledValues } from '../lib/scale-entry'
import { useEditEntryForm } from '../model/use-edit-entry-form'
import { AmountStepper } from './AmountStepper'
import { MealTypeChips } from './MealTypeChips'

interface EditEntryFormProps {
	entry: FoodEntryResponse
	meal: LoggedMeal
	onDone: () => void
}

/**
 * The sheet's body (mockups/chat-edit-entry.html): the food line with the − / + stepper and «було
 * 100 г · 110 ккал», the meal chips, the «Разом» card with the live numbers, «Зберегти» and
 * «Видалити» behind a confirmation. Mounted per entry, so the fields start from it.
 */
export const EditEntryForm = ({ entry, meal, onDone }: EditEntryFormProps) => {
	const { t } = useTranslation()
	const gramsId = useId()
	const errorId = useId()
	const mealLabelId = useId()
	const [isConfirmOpen, setIsConfirmOpen] = useState(false)
	const unit = getAmountUnit(entry.category)
	const { form, onSubmit, isSaving, remove, isDeleting } = useEditEntryForm({
		entry,
		meal,
		onDone,
	})
	const grams = useWatch({ control: form.control, name: 'grams' })
	// the numbers follow the typed weight by density; an unfinished one shows the logged values
	const preview = getScaledValues(entry, parseAmount(grams) ?? entry.grams)
	const isChanged = preview.grams !== entry.grams
	const { errors } = form.formState
	const gramsError = errors.grams?.message
	const isBusy = isSaving || isDeleting

	return (
		<form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-3.5">
			<div className="flex items-center gap-2.5">
				<FoodIcon category={entry.category} />
				<div className="flex min-w-0 flex-1 flex-col">
					<Text as="span" variant="cardTitle">
						{entry.name}
					</Text>
					<Text as="span" variant="small" weight="regular" tone="muted" isTabular>
						{t('entry.kcal', { kcal: formatInteger(preview.kcal) })}
					</Text>
					{isChanged && (
						<Text as="span" variant="small" tone="primaryDeep" isTabular>
							{t('editEntry.was', {
								amount: formatEntryAmount(entry, t),
								kcal: formatInteger(entry.kcal),
							})}
						</Text>
					)}
				</div>
				<Controller
					control={form.control}
					name="grams"
					render={({ field }) => (
						<AmountStepper
							id={gramsId}
							value={field.value}
							onChange={field.onChange}
							onBlur={field.onBlur}
							unit={unit}
							entryName={entry.name}
							isChanged={isChanged}
							aria-invalid={Boolean(gramsError)}
							aria-describedby={gramsError ? errorId : undefined}
						/>
					)}
				/>
			</div>
			{gramsError && (
				<Text as="p" id={errorId} role="alert" variant="small" tone="danger">
					{gramsError}
				</Text>
			)}
			<div className="flex flex-col gap-2">
				<Text as="span" id={mealLabelId} variant="small" tone="muted">
					{t('editEntry.mealType')}
				</Text>
				<Controller
					control={form.control}
					name="mealType"
					render={({ field }) => (
						<MealTypeChips value={field.value} onChange={field.onChange} labelId={mealLabelId} />
					)}
				/>
				{errors.mealType?.message && (
					<Text as="p" role="alert" variant="small" tone="danger">
						{errors.mealType.message}
					</Text>
				)}
			</div>
			<Surface
				variant="soft"
				radius="chip"
				shadow="none"
				className="flex items-center justify-between gap-3 px-3.5 py-3"
			>
				<div className="flex flex-col">
					<Text as="span" variant="caption" weight="bold" tone="primaryDeep">
						{t('editEntry.total')}
					</Text>
					<Text as="span" variant="small" weight="regular" tone="mutedStrong" isTabular>
						{t('entry.macroLine', {
							protein: formatInteger(preview.protein),
							carbs: formatInteger(preview.carbs),
							fat: formatInteger(preview.fat),
						})}
					</Text>
				</div>
				<div className="flex flex-col items-end">
					<Text as="span" weight="extrabold" isTabular className="text-title">
						{t('entry.kcal', { kcal: formatInteger(preview.kcal) })}
					</Text>
					{isChanged && (
						<Text as="span" variant="small" weight="regular" tone="mutedStrong" isTabular>
							{t('editEntry.wasKcal', { kcal: formatInteger(entry.kcal) })}
						</Text>
					)}
				</div>
			</Surface>
			<Button
				type="submit"
				isFullWidth
				isLoading={isSaving}
				loadingText={t('editEntry.saving')}
				disabled={isDeleting}
			>
				{t('editEntry.save')}
			</Button>
			<Button
				variant="textDanger"
				onClick={() => {
					setIsConfirmOpen(true)
				}}
				disabled={isBusy}
				className="self-center"
			>
				{t('editEntry.delete')}
			</Button>
			<ConfirmDialog
				isOpen={isConfirmOpen}
				onOpenChange={setIsConfirmOpen}
				title={t('editEntry.confirmTitle')}
				description={t('editEntry.confirmText', { name: entry.name })}
				cancelLabel={t('editEntry.cancel')}
				confirmLabel={t('editEntry.confirmDelete')}
				onConfirm={remove}
			/>
		</form>
	)
}
