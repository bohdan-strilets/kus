import { useTranslation } from 'react-i18next'

import { ChangePasswordForm } from '@/features/change-password'
import { ROUTES } from '@/shared/config'
import { ScreenHeader, Text } from '@/shared/ui'

/** design/docs/screens.md → Змінити пароль (mockups/change-password.html). */
export const ChangePasswordPage = () => {
	const { t } = useTranslation()

	return (
		<>
			<ScreenHeader title={t('changePassword.title')} backTo={ROUTES.settings} />
			<div className="flex flex-col gap-3 px-gutter pt-2.5 pb-5">
				<ChangePasswordForm />
				<Text variant="caption" weight="regular" tone="muted" className="px-1">
					{t('changePassword.note')}
				</Text>
			</div>
		</>
	)
}
