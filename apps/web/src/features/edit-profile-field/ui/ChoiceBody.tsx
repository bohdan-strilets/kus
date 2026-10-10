import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ProfileFieldKey } from '@/entities/profile'
import { Button, type Option, OptionList } from '@/shared/ui'

import { useSaveProfileField } from '../model/use-save-profile-field'

export interface ChoiceBodyProps {
	field: ProfileFieldKey
	/** Accessible name of the list, e.g. «Стать». */
	label: string
	options: Option<string>[]
	/** The saved option; null — nothing chosen yet and «Зберегти» waits. */
	initialValue: string | null
	/** The chosen option → what PATCH /profile takes for the field. */
	toRequestValue?: (value: string) => unknown
	onSaved: () => void
}

/** «Вибір», «Список з іконками» and «Вибір з підказками» of the edit sheet: pick one, then save. */
export const ChoiceBody = ({
	field,
	label,
	options,
	initialValue,
	toRequestValue,
	onSaved,
}: ChoiceBodyProps) => {
	const { t } = useTranslation()
	const [value, setValue] = useState<string | null>(initialValue)
	const { save, isSaving } = useSaveProfileField({ field, onSaved })

	return (
		<div className="flex flex-col gap-3.5">
			<OptionList value={value} onChange={setValue} options={options} label={label} />
			<Button
				isFullWidth
				isLoading={isSaving}
				disabled={value === null}
				onClick={() => {
					if (value !== null) save(toRequestValue ? toRequestValue(value) : value)
				}}
			>
				{t('profile.data.edit.save')}
			</Button>
		</div>
	)
}
