import { useQuery } from '@tanstack/react-query'

import { dayQueryOptions } from '@/entities/day'
import { DayRecapCard, getDayStats } from '@/entities/stats'
import { ROUTES } from '@/shared/config'

/**
 * «Підсумок дня» at the end of the day before (mockups/chat-new-day.html). A secondary hint, so
 * while it loads, fails or the day is empty there's simply no card.
 */
export const YesterdayRecap = ({ localDate }: { localDate: string }) => {
	const { data } = useQuery(dayQueryOptions(localDate))
	if (!data || data.meals.length === 0) return null

	const { eaten, goal, macros } = getDayStats(data)
	return (
		<DayRecapCard
			eaten={eaten}
			goal={goal}
			protein={macros.protein.value}
			proteinGoal={macros.protein.goal}
			to={`${ROUTES.today}?date=${localDate}`}
		/>
	)
}
