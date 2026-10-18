import type { MeasurementCard as MeasurementCardData } from '@kus/shared'

import { DeletedMeasurementRow, WeightCard } from '@/entities/measurement'
import { freshKey, useFreshOnMount, useFreshReplyStore } from '@/entities/message'
import { useEditMeasurementStore } from '@/features/edit-measurement'

interface MeasurementCardProps {
	card: MeasurementCardData
	today: string
	note?: string
	hasTail: boolean
}

/**
 * A weigh-in card with its «just logged» entrance, played once per fresh reply; a deleted one
 * shrinks to a line. «Редагувати» opens the page's sheet.
 */
export const MeasurementCard = ({ card, today, note, hasTail }: MeasurementCardProps) => {
	const key = freshKey.measurement(card.id)
	const isFresh = useFreshOnMount(key)
	const openEditor = useEditMeasurementStore((state) => state.open)
	if (card.isDeleted) return <DeletedMeasurementRow card={card} hasTail={hasTail} />
	return (
		<WeightCard
			card={card}
			today={today}
			note={note}
			hasTail={hasTail}
			isFresh={isFresh}
			onEdit={() => {
				openEditor(card)
			}}
			onEntered={() => {
				useFreshReplyStore.getState().release(key)
			}}
		/>
	)
}
