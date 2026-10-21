import type { DayCard } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { getMealLabelKey } from '@/entities/entry'
import { formatInteger, formatTime } from '@/shared/lib'
import { Text } from '@/shared/ui'

type DayCardMeal = DayCard['meals'][number]

interface DayCardMealRowProps {
	meal: DayCardMeal
	/** Only today's card tells the hour of a meal. */
	hasTime: boolean
}

/** One meal line of the day card: «Сніданок 08:40 … 370». */
export const DayCardMealRow = ({ meal, hasTime }: DayCardMealRowProps) => {
	const { t } = useTranslation()
	// the meal holds the «Без деталей» estimate: «21:45 · без деталей … ≈ 300»
	const isEstimate = meal.hasUndetailed
	const time = hasTime && meal.eatenAt !== null ? formatTime(new Date(meal.eatenAt)) : null
	const getCaption = (): string | null => {
		if (isEstimate) {
			return time === null ? t('chat.dayCard.undetailed') : t('chat.dayCard.undetailedAt', { time })
		}
		return time
	}
	const caption = getCaption()

	return (
		<li className="flex items-baseline justify-between py-1.5">
			<Text as="span" variant="cardTitle" weight="semibold">
				{t(getMealLabelKey(meal.type))}
				{caption !== null && (
					<Text as="span" variant="small" weight="medium" tone="muted">
						{' '}
						{caption}
					</Text>
				)}
			</Text>
			<Text as="span" variant="cardTitle" isTabular>
				{isEstimate
					? t('chat.dayCard.approx', { kcal: formatInteger(meal.kcal) })
					: formatInteger(meal.kcal)}
			</Text>
		</li>
	)
}
