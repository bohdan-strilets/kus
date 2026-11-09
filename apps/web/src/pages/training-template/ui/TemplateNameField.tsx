import { PROGRAM_TEMPLATE_NAME_UI_MAX } from '@kus/shared'
import { type Control, Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Button, FormField, Input, Text } from '@/shared/ui'

import { isTemplateNameCounterShown, type TemplateNameFormValues } from '../lib/template-name'

interface TemplateNameFieldProps {
	control: Control<TemplateNameFormValues>
	/** Already translated; empty when the name is as saved. */
	error: string | undefined
	/** «Тренування Б»: the way back is offered while the field says something else. */
	defaultName: string
	onRestore: () => void
}

/**
 * mockups/training-names.html: the first field of the editor. It does not stop typing at the limit
 * (the message has to show), the counter wakes up near it.
 */
export const TemplateNameField = ({
	control,
	error,
	defaultName,
	onRestore,
}: TemplateNameFieldProps) => {
	const { t } = useTranslation()

	return (
		<Controller
			control={control}
			name="name"
			render={({ field }) => (
				<div className="flex flex-col gap-1">
					<FormField
						label={t('program.editor.nameLabel')}
						hint={t('program.editor.nameHint')}
						error={error}
						endSlot={
							isTemplateNameCounterShown(field.value) ? (
								<Text as="span" variant="small" tone="muted" isTabular>
									{t('program.editor.nameCounter', {
										current: field.value.length,
										max: PROGRAM_TEMPLATE_NAME_UI_MAX,
									})}
								</Text>
							) : undefined
						}
					>
						{(controlProps) => (
							<Input
								{...field}
								{...controlProps}
								placeholder={defaultName}
								autoComplete="off"
								enterKeyHint="done"
							/>
						)}
					</FormField>
					{field.value.trim() !== defaultName && (
						<Button variant="textOnBackground" className="self-start" onClick={onRestore}>
							{t('program.editor.nameRestore', { name: defaultName })}
						</Button>
					)}
				</div>
			)}
		/>
	)
}
