import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSessionUser } from '@/entities/session'
import { DeleteAccountDialog } from '@/features/delete-account'
import { ADDRESS_FORM_LABEL_KEY, EditAddressFormSheet } from '@/features/edit-address-form'
import { SoundSettingsRows } from '@/features/sound-settings'
import { ROUTES } from '@/shared/config'
import { ListRow, RowGroup, ScreenHeader, Text, useViewportDebugTaps } from '@/shared/ui'

/** design/docs/screens.md → Налаштування (mockups/settings.html, settings-delete-confirm.html). */
export const SettingsPage = () => {
	const { t } = useTranslation()
	const user = useSessionUser()
	const [isDeleteOpen, setIsDeleteOpen] = useState(false)
	const [isAddressOpen, setIsAddressOpen] = useState(false)
	// temporary diagnostic (0.9.1–0.9.2): five taps on the version toggle the viewport overlay
	const onVersionTap = useViewportDebugTaps()
	// the session guard renders /app only with a user; this keeps the types honest
	if (!user) return null

	return (
		<>
			<ScreenHeader title={t('settings.title')} backTo={ROUTES.profile} />
			<div className="flex flex-col gap-3 px-gutter pt-2.5 pb-5">
				<section className="flex flex-col gap-2">
					<Text variant="eyebrow" tone="muted" className="px-1">
						{t('settings.sections.account')}
					</Text>
					<RowGroup>
						<ListRow label={t('settings.email')} value={user.email} />
						<ListRow label={t('settings.changePassword')} to={ROUTES.settingsPassword} />
					</RowGroup>
				</section>
				<section className="flex flex-col gap-2">
					<Text variant="eyebrow" tone="muted" className="px-1">
						{t('settings.sections.kusik')}
					</Text>
					<RowGroup>
						<ListRow
							label={t('settings.address.title')}
							value={t(ADDRESS_FORM_LABEL_KEY[user.addressForm])}
							hasPopup
							onClick={() => {
								setIsAddressOpen(true)
							}}
						/>
					</RowGroup>
				</section>
				<section className="flex flex-col gap-2">
					<Text variant="eyebrow" tone="muted" className="px-1">
						{t('settings.sections.sounds')}
					</Text>
					<SoundSettingsRows />
				</section>
				<RowGroup>
					<ListRow
						label={t('settings.deleteAccount')}
						tone="danger"
						hasPopup
						onClick={() => {
							setIsDeleteOpen(true)
						}}
					/>
				</RowGroup>
				<button type="button" onClick={onVersionTap} className="min-h-tap self-center">
					<Text as="span" variant="small" tone="muted">
						{t('settings.version', { version: __APP_VERSION__ })}
					</Text>
				</button>
			</div>
			<EditAddressFormSheet
				isOpen={isAddressOpen}
				onOpenChange={setIsAddressOpen}
				value={user.addressForm}
			/>
			<DeleteAccountDialog isOpen={isDeleteOpen} onOpenChange={setIsDeleteOpen} />
		</>
	)
}
