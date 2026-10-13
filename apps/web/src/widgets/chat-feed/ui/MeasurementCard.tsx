import type { MeasurementCard as MeasurementCardData } from '@kus/shared'

import { WeightCard } from '@/entities/measurement'
import { freshKey, useFreshOnMount, useFreshReplyStore } from '@/entities/message'

interface MeasurementCardProps {
	card: MeasurementCardData
	today: string
	note?: string
	hasTail: boolean
}

/** A weigh-in card with its «just logged» entrance, played once per fresh reply. */
export const MeasurementCard = ({ card, today, note, hasTail }: MeasurementCardProps) => {
	const key = freshKey.measurement(card.id)
	const isFresh = useFreshOnMount(key)
	return (
		<WeightCard
			card={card}
			today={today}
			note={note}
			hasTail={hasTail}
			isFresh={isFresh}
			onEntered={() => {
				useFreshReplyStore.getState().release(key)
			}}
		/>
	)
}
