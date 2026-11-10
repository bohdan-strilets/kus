import { useTranslation } from 'react-i18next'

import { KusikRow, MessageBubble } from '@/entities/message'
import { Text } from '@/shared/ui'

/**
 * Kusik opens each day (mockups/chat-new-day.html, smileOpen) with a hint only: the greeting by
 * name lives in the header. The usual breakfasts as chips come with memory (stage 5).
 */
export const NewDayGreeting = () => {
	const { t } = useTranslation()

	return (
		<KusikRow kind="newDay">
			<MessageBubble>
				<Text>{t('chat.newDay')}</Text>
			</MessageBubble>
		</KusikRow>
	)
}
