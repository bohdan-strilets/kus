import { zodResolver } from '@hookform/resolvers/zod'
import type { MyFoodResponse } from '@kus/shared'
import { useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { parseDecimalInput } from '@/shared/lib'
import { Button, FormField, Icon, ICON_SIZE, Input, StickyActions, Text } from '@/shared/ui'

import { buildUpdateRequest, isSameAsFood, toFormValues } from '../lib/my-food-form'
import {
	createEditMyFoodSchema,
	type EditMyFoodInput,
	type EditMyFoodValues,
} from '../model/edit-my-food.schema'
import type { MyFoodActions } from '../model/use-my-food-actions'
import { FoodNumberField } from './FoodNumberField'

const DUPLICATE_ERROR_TYPE = 'duplicate'
const NAME_INPUT_NAME = 'food-title'

interface EditMyFoodFormProps {
	food: MyFoodResponse
	actions: MyFoodActions
	onDone: () => void
}

/**
 * The sheet's body (mockups/memory-products.html): the name, the values per 100 g, «1 шт =» and the
 * usual portion, «Зберегти» and «Видалити продукт» without a dialog («Скасувати» in the toast is the
 * way back). Mounted per product, so the fields start from its values.
 */
export const EditMyFoodForm = ({ food, actions, onDone }: EditMyFoodFormProps) => {
	const { t } = useTranslation()
	const schema = useMemo(() => createEditMyFoodSchema(t, { fiber: food.per100g.fiber }), [t, food])
	const form = useForm<EditMyFoodInput, unknown, EditMyFoodValues>({
		resolver: zodResolver(schema),
		defaultValues: toFormValues(food),
		mode: 'onChange',
	})
	const { control, formState } = form
	const attemptCount = formState.submitCount
	const pieceText = useWatch({ control, name: 'pieceGrams' })
	// with «1 шт =» filled the usual portion counts pieces
	const portionUnit = (parseDecimalInput(pieceText) ?? 0) > 0 ? 'unitPieces' : 'unitGrams'
	const isDuplicate = formState.errors.name?.type === DUPLICATE_ERROR_TYPE
	const isBusy = actions.isSaving || actions.isDeleting

	const submit = form.handleSubmit((values) => {
		const request = buildUpdateRequest(values, food, {
			isPortionTouched: Boolean(formState.dirtyFields.portion || formState.dirtyFields.pieceGrams),
		})
		// nothing changed: close without a request
		if (isSameAsFood(request, food)) {
			onDone()
			return
		}
		actions.save(
			{ id: food.id, body: request },
			{
				onSuccess: onDone,
				onDuplicate: (existingName) => {
					form.setError('name', {
						type: DUPLICATE_ERROR_TYPE,
						message: t('editMyFood.duplicate', { name: existingName ?? values.name }),
					})
				},
			},
		)
	})

	return (
		<form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-3.5">
			<Controller
				control={control}
				name="name"
				render={({ field, fieldState }) => (
					<FormField
						label={t('editMyFood.name')}
						error={fieldState.error?.message}
						attemptCount={attemptCount}
					>
						{(controlProps) => (
							<Input
								{...controlProps}
								{...field}
								// iOS offers «AutoFill Contact» for name="name"
								name={NAME_INPUT_NAME}
								autoComplete="off"
								enterKeyHint="done"
							/>
						)}
					</FormField>
				)}
			/>
			<div className="flex flex-col gap-1.5">
				<Text variant="eyebrow" tone="muted" className="px-1">
					{t('editMyFood.per100g')}
				</Text>
				<div className="grid grid-cols-4 gap-1.5">
					<FoodNumberField
						control={control}
						name="kcal"
						label={t('editMyFood.kcal')}
						unit=""
						attemptCount={attemptCount}
					/>
					<FoodNumberField
						control={control}
						name="protein"
						label={t('editMyFood.protein')}
						unit={t('editMyFood.unitGrams')}
						attemptCount={attemptCount}
					/>
					<FoodNumberField
						control={control}
						name="carbs"
						label={t('editMyFood.carbs')}
						unit={t('editMyFood.unitGrams')}
						attemptCount={attemptCount}
					/>
					<FoodNumberField
						control={control}
						name="fat"
						label={t('editMyFood.fat')}
						unit={t('editMyFood.unitGrams')}
						attemptCount={attemptCount}
					/>
				</div>
			</div>
			<div className="grid grid-cols-2 gap-1.5">
				<FoodNumberField
					control={control}
					name="pieceGrams"
					label={t('editMyFood.pieceGrams')}
					unit={t('editMyFood.unitGrams')}
					attemptCount={attemptCount}
				/>
				<FoodNumberField
					control={control}
					name="portion"
					label={t('editMyFood.servingLabel')}
					unit={t(`editMyFood.${portionUnit}`)}
					attemptCount={attemptCount}
				/>
			</div>
			<Text variant="small" weight="regular" tone="muted" className="-mt-1.5 px-1">
				{t('editMyFood.hint')}
			</Text>
			<StickyActions>
				<Button
					type="submit"
					isFullWidth
					isLoading={actions.isSaving}
					loadingText={t('editMyFood.saving')}
					disabled={actions.isDeleting || isDuplicate}
				>
					{t('editMyFood.save')}
				</Button>
				<Button
					variant="textDanger"
					icon={<Icon name="trash" size={ICON_SIZE.control} />}
					onClick={() => {
						actions.remove(food.id, onDone)
					}}
					disabled={isBusy}
					className="self-center"
				>
					{t('editMyFood.delete')}
				</Button>
			</StickyActions>
		</form>
	)
}
