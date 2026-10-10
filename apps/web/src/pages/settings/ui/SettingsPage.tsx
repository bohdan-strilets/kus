import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSessionUser } from '@/entities/session'
import { DeleteAccountDialog } from '@/features/delete-account'
import { SoundSettingsRows } from '@/features/sound-settings'
import { ROUTES } from '@/shared/config'
import { ListRow, RowGroup, ScreenHeader, Text } from '@/shared/ui'

import { getDisplayVersion } from '../lib/get-display-version'

/** design/docs/screens.md → Налаштування (mockups/settings.html, settings-delete-confirm.html). */
export const SettingsPage = () => {
	const { t } = useTranslation()
	const user = useSessionUser()
	const [isDeleteOpen, setIsDeleteOpen] = useState(false)
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
				<Text variant="small" tone="muted" className="self-center">
					{t('settings.version', { version: getDisplayVersion(__APP_VERSION__) })}
				</Text>
			</div>
			<DeleteAccountDialog isOpen={isDeleteOpen} onOpenChange={setIsDeleteOpen} />
		</>
	)
}
