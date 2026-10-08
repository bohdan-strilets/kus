import type { ChatMessage } from '@kus/shared'

import { KusikRow, type KusikReplyKind, MessageBubble } from '@/entities/message'
import { Text } from '@/shared/ui'

import { getClarificationPlacement } from '../lib/get-clarification-placement'
import { MealCard } from './MealCard'

interface KusikReplyProps {
	message: ChatMessage
	isLatest: boolean
}

const getReplyKind = ({ meals, clarifications }: ChatMessage): KusikReplyKind => {
	if (clarifications.some((item) => item.status === 'OPEN')) return 'clarify'
	return meals.length > 0 ? 'mealLogged' : 'reply'
}

/** Kusik's answer: his words, then a card per meal it logged (a whole day → several). */
export const KusikReply = ({ message, isLatest }: KusikReplyProps) => {
	const placement = getClarificationPlacement(message)
	return (
		<KusikRow kind={getReplyKind(message)}>
			<div className="flex flex-col gap-2.5">
				{message.content && (
					<MessageBubble>
						<Text>{message.content}</Text>
					</MessageBubble>
				)}
				{message.meals.map((meal) => (
					<MealCard
						key={meal.id}
						meal={meal}
						clarifications={message.clarifications}
						placement={placement}
						isLatestReply={isLatest}
					/>
				))}
			</div>
		</KusikRow>
	)
}
