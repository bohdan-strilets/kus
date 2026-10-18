import { zodResolver } from '@hookform/resolvers/zod'
import type { MeasurementCard } from '@kus/shared'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { formatMeasurementNumber } from '@/entities/measurement'
import { limitDecimals } from '@/shared/lib'
import { Button, Icon, ICON_SIZE, NumberField } from '@/shared/ui'

import {
	createEditMeasurementSchema,
	type EditMeasurementInput,
	type EditMeasurementValues,
	getBoundMessage,
} from '../model/edit-measurement.schema'
import type { MeasurementActions } from '../model/use-measurement-actions'

/** Weight and waist are kept to tenths; the server rounds the same way. */
const MAX_DECIMALS = 1
const TENTHS = 10

interface EditMeasurementFormProps {
	card: MeasurementCard
	actions: MeasurementActions
	onDone: () => void
}

/**
 * The sheet's body (mockups/measurement-edit.html): the number with its unit, «Зберегти» and,
 * under it, «Видалити замір» without a dialog: «Повернути» in the toast is the way back.
 * Mounted per card, so the field starts from its value.
 */
export const EditMeasurementForm = ({ card, actions, onDone }: EditMeasurementFormProps) => {
	const { t } = useTranslation()
	const { kind } = card
	const schema = useMemo(() => createEditMeasurementSchema(t, kind), [t, kind])
	const form = useForm<EditMeasurementInput, unknown, EditMeasurementValues>({
		resolver: zodResolver(schema),
		defaultValues: { value: formatMeasurementNumber(card.value, kind) },
		mode: 'onChange',
	})
	const isBusy = actions.isSaving || actions.isDeleting

	return (
		<form
			noValidate
			onSubmit={(event) =>
				void form.handleSubmit((values) => {
					// nothing changed: close without a request
					if (Math.round(values.value * TENTHS) === Math.round(card.value * TENTHS)) {
						onDone()
						return
					}
					actions.save(
						{ id: card.id, value: values.value },
						{
							onSuccess: onDone,
							onBound: (code) => {
								form.setError('value', { message: getBoundMessage(t, kind, code) })
							},
						},
					)
				})(event)
			}
			className="flex flex-col gap-3.5"
		>
			<Controller
				control={form.control}
				name="value"
				render={({ field: input, fieldState }) => (
					<NumberField
						label={t(`editMeasurement.title.${kind}`)}
						unit={t(`editMeasurement.unit.${kind}`)}
						inputMode="decimal"
						value={input.value}
						onChange={(text) => {
							input.onChange(limitDecimals(text, MAX_DECIMALS))
						}}
						onBlur={input.onBlur}
						name={input.name}
						error={fieldState.error?.message}
						attemptCount={form.formState.submitCount}
					/>
				)}
			/>
			<Button
				type="submit"
				isFullWidth
				isLoading={actions.isSaving}
				loadingText={t('editMeasurement.saving')}
				disabled={actions.isDeleting}
			>
				{t('editMeasurement.save')}
			</Button>
			<Button
				variant="textDanger"
				icon={<Icon name="trash" size={ICON_SIZE.control} />}
				onClick={() => {
					actions.remove(card.id, onDone)
				}}
				disabled={isBusy}
				className="self-center"
			>
				{t('editMeasurement.delete')}
			</Button>
		</form>
	)
}
