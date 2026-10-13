import { useTranslation } from 'react-i18next'

import { Button, Text } from '@/shared/ui'

/** The caption under «Тіло» with the link that opens MeasureInfoSheet. */
export const MeasureNote = ({ onOpenInfo }: { onOpenInfo: () => void }) => {
	const { t } = useTranslation()

	return (
		<div className="flex flex-col items-start gap-0.5 px-1">
			<Text variant="caption" weight="regular" tone="mutedStrong">
				{t('profile.data.measureNote')}
			</Text>
			{/* the button's own padding is cancelled so the link text lines up with the caption */}
			<Button variant="textOnBackground" size="sm" className="-ml-4" onClick={onOpenInfo}>
				{t('profile.data.measureLink')}
			</Button>
		</div>
	)
}
