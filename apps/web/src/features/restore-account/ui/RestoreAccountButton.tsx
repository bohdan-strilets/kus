import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui'

import { useRestoreAccount } from '../model/use-restore-account'

export const RestoreAccountButton = () => {
	const { t } = useTranslation()
	const { restore, isPending } = useRestoreAccount()

	return (
		<Button
			isFullWidth
			isLoading={isPending}
			loadingText={t('accountRestore.restoring')}
			onClick={restore}
		>
			{t('accountRestore.restore')}
		</Button>
	)
}
