import { useTranslation } from 'react-i18next'

import { Icon, ICON_SIZE, Text } from '@/shared/ui'

/** mockups/training-rest.html, «iOS»: the screen may go dark, so the signal is heard only with Kusik open. */
export const WakeLockHint = () => {
	const { t } = useTranslation()

	return (
		<div className="px-gutter pb-1">
			<div className="flex items-center gap-2 rounded-tile-sm bg-hint-day-bg px-3 py-2 text-hint-day-ink">
				<Icon name="info" size={ICON_SIZE.small} className="flex-none" />
				<Text as="p" variant="caption" className="text-hint-day-ink">
					{t('training.live.rest.wakeLockHint')}
				</Text>
			</div>
		</div>
	)
}
