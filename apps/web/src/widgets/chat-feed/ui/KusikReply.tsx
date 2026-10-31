import type { ChatMessage } from '@kus/shared'

import { pickAchievement } from '@/entities/achievement'
import { StatsCard, useGoalCelebrationStore } from '@/entities/stats'
import { KusikRow, type KusikReplyKind, MessageBubble } from '@/entities/message'
import { FactProposalPlaque } from '@/features/answer-fact-proposal'
import { Text } from '@/shared/ui'

import { getClarificationPlacement } from '../lib/get-clarification-placement'
import { getWorkoutCards } from '../lib/get-workout-cards'
import type { FeedPhotoStatus } from '../model/feed.types'
import { useAchievementFace } from '../model/use-achievement-face'
import { AchievementCard } from './AchievementCard'
import { DayCard } from './DayCard'
import { MealCard } from './MealCard'
import { MeasurementCard } from './MeasurementCard'
import { WorkoutReplyCard } from './WorkoutReplyCard'

interface KusikReplyProps {
	message: ChatMessage
	isLatest: boolean
	/** `YYYY-MM-DD` in the user's timezone: a measurement card says «сьогодні» only for it. */
	today: string
	/** How the photo of the message this answers went. */
	photoStatus?: FeedPhotoStatus
}

interface ReplyKindParams {
	message: ChatMessage
	photoStatus: KusikReplyProps['photoStatus']
	isGoalReached: boolean
	/** A fresh achievement card has popped: the same glad face as for the day goal. */
	isAchievementReached: boolean
}

const getReplyKind = ({
	message,
	photoStatus,
	isGoalReached,
	isAchievementReached,
}: ReplyKindParams): KusikReplyKind => {
	const { replyToId, meals, measurements, clarifications } = message
	// the only message Kusik writes on his own, without a user turn: the welcome back after a restore
	if (replyToId === null) return 'welcomeBack'
	if (photoStatus === 'FAILED') return 'photoFail'
	if (clarifications.some((item) => item.status === 'OPEN')) return 'clarify'
	if (isGoalReached || isAchievementReached) return 'goalReached'
	if (meals.length === 0) return measurements.length > 0 ? 'weight' : 'reply'
	return photoStatus === 'PROCESSED' ? 'photoEstimate' : 'mealLogged'
}

/** Under the bubble, past the 34px head and its 8px gap. */
const ATTACHMENTS_CLASS = 'flex flex-col gap-1.5 pr-4 pl-10.5'

/**
 * Kusik's answer: his words in the glass bubble next to his head, then a solid card per meal it
 * logged (a whole day → several) and per measurement, indented under the bubble as its attachments.
 * Workout cards follow the same way. A closing card hides his words: only the card stays. Without words the card itself sits next to the head (mockups/chat.html). A bare weigh-in has no
 * bubble: his words sit inside the card (mockups/chat-weight.html).
 */
export const KusikReply = ({ message, isLatest, today, photoStatus }: KusikReplyProps) => {
	const placement = getClarificationPlacement(message)
	const isGoalReached = useGoalCelebrationStore((state) => state.celebratedReplyId === message.id)
	const isAchievementReached = useAchievementFace(message)
	const kind = getReplyKind({ message, photoStatus, isGoalReached, isAchievementReached })
	const hasMeals = message.meals.length > 0
	const hasMeasurements = message.measurements.length > 0
	const achievement = pickAchievement(message.achievements)
	const renderMeals = (hasTail: boolean) =>
		message.meals.map((meal, index) => (
			<MealCard
				key={meal.id}
				meal={meal}
				today={today}
				clarifications={message.clarifications}
				placement={placement}
				isLatestReply={isLatest}
				hasTail={hasTail}
				index={index}
			/>
		))
	const renderMeasurements = ({ hasTail, note }: { hasTail: boolean; note?: string }) =>
		message.measurements.map((card, index) => (
			<MeasurementCard
				key={card.id}
				card={card}
				today={today}
				hasTail={hasTail && index === 0}
				note={index === 0 ? note : undefined}
			/>
		))

	const workoutCards = getWorkoutCards(message)
	const hasWorkouts = workoutCards.length > 0
	const renderWorkouts = (hasTail: boolean) =>
		workoutCards.map((item, index) => (
			<WorkoutReplyCard
				key={`${item.workout.id}-${item.variant}`}
				item={item}
				hasTail={hasTail && index === 0}
			/>
		))

	// close_day: the card follows the words and the estimate's meal card, with its own fixed sentence
	// an empty day draws no card (the backend sends none; the front cuts it off too): only the text stays
	const dayCard = message.dayCard?.verdict === 'empty' ? null : message.dayCard
	const closingCard = dayCard?.isClosing ? dayCard : null
	// the closing card says it all with its own fixed sentence: the model's words are not shown
	const content = closingCard ? null : message.content
	const renderClosingCard = (hasTail: boolean) =>
		closingCard && <DayCard card={closingCard} today={today} hasTail={hasTail} />

	// the rarest thing a reply brings goes last, under the meal and measurement cards
	const renderAchievement = () => achievement && <AchievementCard achievement={achievement} />

	if (hasMeasurements && !hasMeals) {
		const [firstCard, ...otherCards] = renderMeasurements({
			hasTail: true,
			note: content || undefined,
		})
		return (
			<div className="flex flex-col gap-1.5 self-stretch">
				<KusikRow kind={kind}>{firstCard}</KusikRow>
				{(otherCards.length > 0 || hasWorkouts || achievement) && (
					<div className={ATTACHMENTS_CLASS}>
						{otherCards}
						{renderWorkouts(false)}
						{renderAchievement()}
					</div>
				)}
			</div>
		)
	}

	// a day snapshot (show_day): Kusik's one sentence sits inside the card, as in chat-day-card.html
	if (dayCard && !closingCard) {
		return (
			<KusikRow kind={kind}>
				<DayCard card={dayCard} today={today} note={content || undefined} />
			</KusikRow>
		)
	}

	// a period snapshot (show_stats): like the closing card, the card alone — the model's words
	// next to it drifted into templates («Ось твій місяць», «Глянь на картці»), so they are not shown
	if (message.statsCard) {
		return (
			<KusikRow kind={kind}>
				<StatsCard card={message.statsCard} today={today} />
			</KusikRow>
		)
	}

	// a fact to remember sits inside the bubble under his words (mockups/memory-facts.html)
	const factPlaque = message.factProposal && <FactProposalPlaque proposal={message.factProposal} />

	if (!content && !factPlaque) {
		return (
			<KusikRow kind={kind}>
				<div className="flex flex-col gap-1.5">
					{renderMeals(true)}
					{renderMeasurements({ hasTail: false })}
					{renderWorkouts(!hasMeals && !hasMeasurements)}
					{renderClosingCard(!hasMeals && !hasMeasurements && !hasWorkouts)}
					{renderAchievement()}
				</div>
			</KusikRow>
		)
	}
	return (
		<div className="flex flex-col gap-1.5 self-stretch">
			<KusikRow kind={kind}>
				<MessageBubble>
					<div className="flex flex-col gap-2.5">
						{content && <Text>{content}</Text>}
						{factPlaque}
					</div>
				</MessageBubble>
			</KusikRow>
			{(hasMeals || hasMeasurements || hasWorkouts || achievement || closingCard) && (
				<div className={ATTACHMENTS_CLASS}>
					{renderMeals(false)}
					{renderMeasurements({ hasTail: false })}
					{renderWorkouts(false)}
					{renderClosingCard(false)}
					{renderAchievement()}
				</div>
			)}
		</div>
	)
}
