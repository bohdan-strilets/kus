import type { AddressForm } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { BaseBottomSheet } from '@/shared/ui'

import { AddressFormBody } from './AddressFormBody'

interface EditAddressFormSheetProps {
	isOpen: boolean
	onOpenChange: (isOpen: boolean) => void
	/** The saved form; the body remounts on every open, so the choice starts from it. */
	value: AddressForm
}

/** mockups/settings-address.html: how Kusik addresses the user (grammatical gender). */
export const EditAddressFormSheet = ({
	isOpen,
	onOpenChange,
	value,
}: EditAddressFormSheetProps) => {
	const { t } = useTranslation()

	return (
		<BaseBottomSheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={t('settings.address.title')}
			description={t('settings.address.hint')}
			isDescriptionFullWidth
		>
			{isOpen && (
				<AddressFormBody
					value={value}
					onSaved={() => {
						onOpenChange(false)
					}}
				/>
			)}
		</BaseBottomSheet>
	)
}
