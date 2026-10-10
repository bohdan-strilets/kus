import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import type { ProfileFieldKey } from '@/entities/profile'
import { Button, NumberField } from '@/shared/ui'

import type { FieldDefinition } from '../model/field-definitions.types'
import {
	createNumberFieldSchema,
	type NumberFieldInput,
	type NumberFieldValues,
} from '../model/number-field.schema'
import { useSaveProfileField } from '../model/use-save-profile-field'

interface NumberBodyProps {
	field: ProfileFieldKey
	definition: Extract<FieldDefinition, { kind: 'number' }>
	/** The text the field starts with; empty — not set yet. */
	initialValue: string
	onSaved: () => void
}

/** «Число з одиницею»: one big number, validated on the go, errors under it. */
export const NumberBody = ({ field, definition, initialValue, onSaved }: NumberBodyProps) => {
	const { t } = useTranslation()
	const { isInteger, limits, inputLabelKey, unitKey, inputMode } = definition
	const schema = useMemo(
		() => createNumberFieldSchema(t, { isInteger, min: limits.min, max: limits.max }),
		[t, isInteger, limits.min, limits.max],
	)
	const form = useForm<NumberFieldInput, unknown, NumberFieldValues>({
		resolver: zodResolver(schema),
		defaultValues: { value: initialValue },
		mode: 'onChange',
	})
	const { save, isSaving } = useSaveProfileField({
		field,
		onSaved,
		onFieldError: (message) => {
			form.setError('value', { message })
		},
	})

	return (
		<form
			noValidate
			onSubmit={(event) =>
				void form.handleSubmit((values) => {
					save(values.value)
				})(event)
			}
			className="flex flex-col gap-3.5"
		>
			<Controller
				control={form.control}
				name="value"
				render={({ field: input, fieldState }) => (
					<NumberField
						label={t(inputLabelKey)}
						unit={t(unitKey)}
						inputMode={inputMode}
						value={input.value}
						onChange={input.onChange}
						onBlur={input.onBlur}
						name={input.name}
						error={fieldState.error?.message}
						attemptCount={form.formState.submitCount}
					/>
				)}
			/>
			<Button type="submit" isFullWidth isLoading={isSaving}>
				{t('profile.data.edit.save')}
			</Button>
		</form>
	)
}
