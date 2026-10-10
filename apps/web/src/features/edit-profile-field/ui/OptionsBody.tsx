import { useTranslation } from 'react-i18next'

import type { ProfileFieldKey } from '@/entities/profile'

import type { ChoiceOptionDefinition } from '../model/field-definitions.types'
import { ChoiceBody } from './ChoiceBody'

interface OptionsBodyProps {
	field: ProfileFieldKey
	options: ChoiceOptionDefinition[]
	initialValue: string | null
	onSaved: () => void
}

/** «Вибір» (sex, goal): a plain list of labelled options. */
export const OptionsBody = ({ field, options, initialValue, onSaved }: OptionsBodyProps) => {
	const { t } = useTranslation()

	return (
		<ChoiceBody
			field={field}
			label={t(`profile.data.fields.${field}`)}
			options={options.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
			initialValue={initialValue}
			onSaved={onSaved}
		/>
	)
}
