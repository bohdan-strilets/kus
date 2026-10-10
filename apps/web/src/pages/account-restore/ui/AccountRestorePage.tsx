import { useTranslation } from 'react-i18next'

import { useSessionUser } from '@/entities/session'
import { RestoreAccountButton } from '@/features/restore-account'
import { LogoutButton } from '@/features/logout'
import { formatShortDate } from '@/shared/lib'
import { Hamster, Heading, Text } from '@/shared/ui'

const HAMSTER_SIZE = 120

/** design/docs/screens.md → Відновлення акаунта (mockups/account-restore.html): no header, no nav. */
export const AccountRestorePage = () => {
	const { t } = useTranslation()
	const user = useSessionUser()
	// the session guard renders /app only with a user; this keeps the types honest
	if (!user) return null
	const date = user.purgeAt ? formatShortDate(new Date(user.purgeAt), user.timezone) : ''

	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-4.5 px-6 text-center">
			<Hamster mood="oops" size={HAMSTER_SIZE} />
			<div className="flex flex-col items-center gap-2">
				<Heading as="h1">{t('accountRestore.title', { date })}</Heading>
				<Text tone="mutedStrong">{t('accountRestore.text', { email: user.email })}</Text>
			</div>
			<div className="mt-1.5 flex w-full flex-col gap-2">
				<RestoreAccountButton />
				<LogoutButton tone="plain" label={t('accountRestore.logout')} />
			</div>
			<Text variant="small" weight="regular" tone="muted">
				{t('accountRestore.note', { date })}
			</Text>
		</div>
	)
}
