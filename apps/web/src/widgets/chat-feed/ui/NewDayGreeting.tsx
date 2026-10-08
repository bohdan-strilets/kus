import { useTranslation } from 'react-i18next'

import { KusikRow, MessageBubble } from '@/entities/message'
import { type Addressee, useGreeting } from '@/entities/user'
import { Text } from '@/shared/ui'

interface NewDayGreetingProps {
	addressee: Addressee
	timeZone: string
}

/**
 * Kusik opens each day (mockups/chat-new-day.html, smileOpen). The usual breakfasts as chips come
 * with memory (stage 5), so the text stops before «тапни звичний варіант».
 */
export const NewDayGreeting = ({ addressee, timeZone }: NewDayGreetingProps) => {
	const { t } = useTranslation()
	const greeting = useGreeting({ addressee, timeZone })

	return (
		<KusikRow kind="newDay">
			<MessageBubble>
				<Text>{t('chat.newDay', { greeting })}</Text>
			</MessageBubble>
		</KusikRow>
	)
}
