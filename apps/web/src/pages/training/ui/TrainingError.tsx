import { useTranslation } from 'react-i18next'

import { Button, Icon, Surface, Text } from '@/shared/ui'

const ERROR_ICON_SIZE = 20
const RETRY_ICON_SIZE = 16

/** mockups/training-tab.html, error: the message and «Спробувати ще» in place of the list. */
export const TrainingError = ({ onRetry }: { onRetry: () => void }) => {
	const { t } = useTranslation()

	return (
		<Surface
			variant="list"
			radius="bubbleAi"
			role="alert"
			className="flex flex-col items-start gap-2.5 p-4"
		>
			<div className="flex items-start gap-2">
				<Icon name="alert" size={ERROR_ICON_SIZE} className="shrink-0 text-danger" />
				<Text>{t('training.loadError')}</Text>
			</div>
			<Button variant="secondary" size="md" className="min-h-11" onClick={onRetry}>
				<span className="inline-flex items-center gap-1.5">
					<Icon name="retry" size={RETRY_ICON_SIZE} />
					{t('training.retry')}
				</span>
			</Button>
		</Surface>
	)
}
