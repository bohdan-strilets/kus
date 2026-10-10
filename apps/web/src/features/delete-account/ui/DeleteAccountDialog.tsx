import { Controller } from 'react-hook-form'
import { Trans, useTranslation } from 'react-i18next'

import { formatShortDate } from '@/shared/lib'
import { ConfirmDialog, FormField, Hamster, Icon, Input, Surface, Text } from '@/shared/ui'

import { getPurgeDate } from '../lib/get-purge-date'
import { useDeleteAccount } from '../model/use-delete-account'

const HAMSTER_SIZE = 84
const NOTE_ICON_SIZE = 20

export interface DeleteAccountDialogProps {
	isOpen: boolean
	onOpenChange: (isOpen: boolean) => void
}

/** mockups/settings-delete-confirm.html: the password confirms; a wrong one keeps the dialog open. */
export const DeleteAccountDialog = ({ isOpen, onOpenChange }: DeleteAccountDialogProps) => {
	const { t } = useTranslation()
	const { form, onSubmit, isDeleting } = useDeleteAccount()
	const password = form.watch('password')

	const handleOpenChange = (nextIsOpen: boolean): void => {
		if (!nextIsOpen) form.reset()
		onOpenChange(nextIsOpen)
	}

	return (
		<ConfirmDialog
			isOpen={isOpen}
			onOpenChange={handleOpenChange}
			title={t('deleteAccount.title')}
			description={t('deleteAccount.text')}
			illustration={<Hamster mood="oops" size={HAMSTER_SIZE} />}
			cancelLabel={t('deleteAccount.cancel')}
			confirmLabel={t('deleteAccount.confirm')}
			isConfirmDisabled={password.trim() === ''}
			isConfirmLoading={isDeleting}
			confirmLoadingText={t('deleteAccount.deleting')}
			onConfirm={() => {
				void onSubmit()
			}}
		>
			<Surface
				variant="field"
				radius="tile"
				shadow="none"
				className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
			>
				<Icon name="retry" size={NOTE_ICON_SIZE} className="shrink-0 text-primary" />
				<Text variant="caption" weight="regular">
					<Trans
						i18nKey="deleteAccount.restoreNote"
						values={{ date: formatShortDate(getPurgeDate()) }}
						components={{ b: <b className="font-extrabold" /> }}
					/>
				</Text>
			</Surface>
			<div className="w-full text-left">
				<Controller
					control={form.control}
					name="password"
					render={({ field, fieldState }) => (
						// no «show password» button: the mockup has none and the placeholder needs the width
						<FormField
							label={t('deleteAccount.password')}
							error={fieldState.error?.message}
							attemptCount={form.formState.submitCount}
						>
							{(controlProps) => (
								<Input
									type="password"
									autoComplete="current-password"
									autoCapitalize="none"
									spellCheck={false}
									placeholder={t('deleteAccount.passwordPlaceholder')}
									{...field}
									{...controlProps}
								/>
							)}
						</FormField>
					)}
				/>
			</div>
		</ConfirmDialog>
	)
}
