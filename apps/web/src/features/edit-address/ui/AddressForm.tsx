import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Button, FormField, Input } from '@/shared/ui'

import { useAddressForm } from '../model/use-address-form'

/** «Як до тебе звертатися?» — the name Kusik greets with; empty means the name from registration. */
export const AddressForm = ({ addressAs }: { addressAs: string | null }) => {
	const { t } = useTranslation()
	const { form, onSubmit, isSaving } = useAddressForm(addressAs)
	const { errors, submitCount } = form.formState

	return (
		<form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-3">
			<Controller
				control={form.control}
				name="addressAs"
				render={({ field }) => (
					<FormField
						label={t('profile.address.label')}
						hint={t('profile.address.hint')}
						error={errors.addressAs?.message}
						attemptCount={submitCount}
					>
						{(controlProps) => <Input {...field} {...controlProps} autoComplete="nickname" />}
					</FormField>
				)}
			/>
			<Button type="submit" variant="secondary" isLoading={isSaving}>
				{t('profile.address.save')}
			</Button>
		</form>
	)
}
