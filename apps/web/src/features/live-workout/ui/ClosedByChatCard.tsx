import { useTranslation } from 'react-i18next'

import { Button, Surface, Text } from '@/shared/ui'

/** G3: the chat finished the session meanwhile; the way on is the finished training. */
export const ClosedByChatCard = ({ onOpen }: { onOpen: () => void }) => {
	const { t } = useTranslation()

	return (
		<Surface radius="card" className="mx-gutter flex flex-col items-start gap-2 p-3.5">
			<Text role="status" variant="body" weight="bold">
				{t('training.live.closedByChat')}
			</Text>
			<Button onClick={onOpen}>{t('workout.summary.open')}</Button>
		</Surface>
	)
}
