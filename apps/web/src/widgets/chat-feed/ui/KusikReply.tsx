import type { ChatMessage } from '@kus/shared'

import { useGoalCelebrationStore } from '@/entities/stats'
import { KusikRow, type KusikReplyKind, MessageBubble } from '@/entities/message'
import { Text } from '@/shared/ui'

import { getClarificationPlacement } from '../lib/get-clarification-placement'
import type { FeedPhotoStatus } from '../model/feed.types'
import { MealCard } from './MealCard'

interface KusikReplyProps {
	message: ChatMessage
	isLatest: boolean
	/** How the photo of the message this answers went. */
	photoStatus?: FeedPhotoStatus
}

interface ReplyKindParams {
	message: ChatMessage
	photoStatus: KusikReplyProps['photoStatus']
	isGoalReached: boolean
}

const getReplyKind = ({ message, photoStatus, isGoalReached }: ReplyKindParams): KusikReplyKind => {
	const { replyToId, meals, clarifications } = message
	// the only message Kusik writes on his own, without a user turn: the welcome back after a restore
	if (replyToId === null) return 'welcomeBack'
	if (photoStatus === 'FAILED') return 'photoFail'
	if (clarifications.some((item) => item.status === 'OPEN')) return 'clarify'
	if (isGoalReached) return 'goalReached'
	if (meals.length === 0) return 'reply'
	return photoStatus === 'PROCESSED' ? 'photoEstimate' : 'mealLogged'
}

/**
 * Kusik's answer: his words in the glass bubble next to his head, then a solid card per meal it
 * logged (a whole day → several), indented under the bubble as its attachments. Without words the
 * card itself sits next to the head (mockups/chat.html).
 */
export const KusikReply = ({ message, isLatest, photoStatus }: KusikReplyProps) => {
	const placement = getClarificationPlacement(message)
	const isGoalReached = useGoalCelebrationStore((state) => state.celebratedReplyId === message.id)
	const kind = getReplyKind({ message, photoStatus, isGoalReached })
	const renderCards = (hasTail: boolean) =>
		message.meals.map((meal, index) => (
			<MealCard
				key={meal.id}
				meal={meal}
				clarifications={message.clarifications}
				placement={placement}
				isLatestReply={isLatest}
				hasTail={hasTail}
				index={index}
			/>
		))

	if (!message.content) {
		return (
			<KusikRow kind={kind}>
				<div className="flex flex-col gap-1.5">{renderCards(true)}</div>
			</KusikRow>
		)
	}
	return (
		<div className="flex flex-col gap-1.5 self-stretch">
			<KusikRow kind={kind}>
				<MessageBubble>
					<Text>{message.content}</Text>
				</MessageBubble>
			</KusikRow>
			{message.meals.length > 0 && (
				// under the bubble, past the 34px head and its 8px gap
				<div className="flex flex-col gap-1.5 pr-4 pl-10.5">{renderCards(false)}</div>
			)}
		</div>
	)
}
