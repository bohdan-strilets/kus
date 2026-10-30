import { zodResolver } from '@hookform/resolvers/zod'
import type { FactResponse } from '@kus/shared'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Button, FormField, Icon, ICON_SIZE, StickyActions, Textarea } from '@/shared/ui'

import {
	createEditFactSchema,
	type EditFactInput,
	type EditFactValues,
	getFactFieldMessage,
} from '../model/edit-fact.schema'
import type { FactActions } from '../model/use-fact-actions'

interface EditFactFormProps {
	fact: FactResponse
	actions: FactActions
	onDone: () => void
}

/**
 * The sheet's body (mockups/memory-facts.html «Sheet факту»): the sentence, «Зберегти» and
 * «Видалити факт» without a dialog («Скасувати» in the toast is the way back). Mounted per fact.
 */
export const EditFactForm = ({ fact, actions, onDone }: EditFactFormProps) => {
	const { t } = useTranslation()
	const schema = useMemo(() => createEditFactSchema(t), [t])
	const form = useForm<EditFactInput, unknown, EditFactValues>({
		resolver: zodResolver(schema),
		defaultValues: { text: fact.text },
		mode: 'onChange',
	})
	const isBusy = actions.isSaving || actions.isDeleting

	return (
		<form
			noValidate
			onSubmit={(event) =>
				void form.handleSubmit((values) => {
					// nothing changed: close without a request
					if (values.text === fact.text) {
						onDone()
						return
					}
					actions.save(
						{ id: fact.id, text: values.text },
						{
							onSuccess: onDone,
							onFieldError: (code) => {
								form.setError('text', { message: getFactFieldMessage(code, t) })
							},
						},
					)
				})(event)
			}
			className="flex flex-col gap-3.5"
		>
			<Controller
				control={form.control}
				name="text"
				render={({ field, fieldState }) => (
					<FormField
						label={t('editFact.field')}
						hint={t('editFact.hint')}
						error={fieldState.error?.message}
						attemptCount={form.formState.submitCount}
					>
						{(controlProps) => (
							<Textarea variant="field" {...controlProps} {...field} autoComplete="off" rows={2} />
						)}
					</FormField>
				)}
			/>
			<StickyActions>
				<Button
					type="submit"
					isFullWidth
					isLoading={actions.isSaving}
					loadingText={t('editFact.saving')}
					disabled={actions.isDeleting}
				>
					{t('editFact.save')}
				</Button>
				<Button
					variant="textDanger"
					icon={<Icon name="trash" size={ICON_SIZE.control} />}
					onClick={() => {
						actions.remove(fact.id, onDone)
					}}
					disabled={isBusy}
					className="self-center"
				>
					{t('editFact.delete')}
				</Button>
			</StickyActions>
		</form>
	)
}
