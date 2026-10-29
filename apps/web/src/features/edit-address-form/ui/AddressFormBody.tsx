import type { AddressForm } from '@kus/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, type Option, OptionList, Text } from '@/shared/ui'

import { ADDRESS_FORM_ORDER, DEFAULT_ADDRESS_FORM } from '../model/address-form.constants'
import { useSaveAddressForm } from '../model/use-save-address-form'

interface AddressFormBodyProps {
	value: AddressForm
	onSaved: () => void
}

/** Three cards with a sample phrase each; nothing is sent until «Зберегти». */
export const AddressFormBody = ({ value, onSaved }: AddressFormBodyProps) => {
	const { t } = useTranslation()
	const [chosen, setChosen] = useState<AddressForm>(value)
	const { save, isSaving } = useSaveAddressForm({ onSaved })

	const options: Option<AddressForm>[] = ADDRESS_FORM_ORDER.map((form) => ({
		value: form,
		label: t(`settings.address.options.${form}.label`),
		hint: form === DEFAULT_ADDRESS_FORM ? t('settings.address.default') : undefined,
		example: t(`settings.address.options.${form}.example`),
	}))

	return (
		<div className="flex flex-col gap-3.5">
			<OptionList
				value={chosen}
				onChange={setChosen}
				options={options}
				label={t('settings.address.title')}
			/>
			<Text as="p" variant="small" weight="regular" tone="muted">
				{t('settings.address.note')}
			</Text>
			<Button
				isFullWidth
				isLoading={isSaving}
				onClick={() => {
					save(chosen)
				}}
			>
				{t('settings.address.save')}
			</Button>
		</div>
	)
}
