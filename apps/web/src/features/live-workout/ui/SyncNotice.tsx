import { useTranslation } from 'react-i18next'

import { Button, Text } from '@/shared/ui'

import type { LiveSyncStatus } from '../model/create-live-sync'

interface SyncNoticeProps {
	status: LiveSyncStatus
	onRetry: () => void
}

/** The line under the header while sets wait for the connection (G4) or the server refuses them. */
export const SyncNotice = ({ status, onRetry }: SyncNoticeProps) => {
	const { t } = useTranslation()
	if (status === 'idle' || status === 'saving') return null

	return (
		<div role="status" className="flex items-center justify-between gap-2 px-gutter pb-1.5">
			<Text variant="caption" tone="mutedStrong">
				{status === 'offline' ? t('training.live.offline') : t('training.live.syncError')}
			</Text>
			{status === 'error' && (
				<Button size="sm" variant="textOnBackground" onClick={onRetry}>
					{t('common.retry')}
				</Button>
			)}
		</div>
	)
}
