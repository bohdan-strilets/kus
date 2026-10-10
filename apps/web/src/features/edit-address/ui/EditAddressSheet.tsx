import { useTranslation } from 'react-i18next'

import { BaseBottomSheet } from '@/shared/ui'

import { AddressForm } from './AddressForm'

interface EditAddressSheetProps {
	isOpen: boolean
	onOpenChange: (isOpen: boolean) => void
	addressAs: string | null
}

/** «Як до тебе звертатися?» from the profile card; closes once the name is saved. */
export const EditAddressSheet = ({ isOpen, onOpenChange, addressAs }: EditAddressSheetProps) => {
	const { t } = useTranslation()

	return (
		<BaseBottomSheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={t('profile.address.label')}
			description={t('profile.address.hint')}
			initialFocus="first-field"
		>
			{isOpen && (
				<AddressForm
					addressAs={addressAs}
					onSaved={() => {
						onOpenChange(false)
					}}
				/>
			)}
		</BaseBottomSheet>
	)
}
