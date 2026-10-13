import type { ProgressResponse } from '@kus/shared'

import {
	InsightCard,
	type ProgressRange,
	WaistProgressRow,
	WeekCaloriesCard,
	WeightProgressCard,
} from '@/entities/progress'

import { WeightCta } from './WeightCta'

interface ProgressContentProps {
	progress: ProgressResponse
	range: ProgressRange
}

/** Weight (or the invitation to record it), waist when there is one, the 7-day week, the insight. */
export const ProgressContent = ({ progress, range }: ProgressContentProps) => {
	const { weight, waist, week, insight, to } = progress

	return (
		<>
			{weight ? <WeightProgressCard weight={weight} range={range} today={to} /> : <WeightCta />}
			{waist && <WaistProgressRow waist={waist} />}
			{week.avgKcal !== null && <WeekCaloriesCard week={week} today={to} />}
			<InsightCard insight={insight} />
		</>
	)
}
