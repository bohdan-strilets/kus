import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Button, FormField, Input } from '@/shared/ui'

import { useAddressForm } from '../model/use-address-form'

interface AddressFormProps {
	addressAs: string | null
	onSaved?: () => void
}

/** The name Kusik greets with; empty means the name from registration. The hint is the sheet's description. */
export const AddressForm = ({ addressAs, onSaved }: AddressFormProps) => {
	const { t } = useTranslation()
	const { form, onSubmit, isSaving } = useAddressForm({ addressAs, onSaved })
	const { errors, submitCount } = form.formState

	return (
		<form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-3">
			<Controller
				control={form.control}
				name="addressAs"
				render={({ field }) => (
					<FormField
						label={t('profile.address.label')}
						error={errors.addressAs?.message}
						attemptCount={submitCount}
					>
						{(controlProps) => <Input {...field} {...controlProps} autoComplete="nickname" />}
					</FormField>
				)}
			/>
			<Button type="submit" isFullWidth isLoading={isSaving}>
				{t('profile.address.save')}
			</Button>
		</form>
	)
}
