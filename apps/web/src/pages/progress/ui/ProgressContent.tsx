import type { ProgressResponse } from '@kus/shared'

import {
	InsightCard,
	type ProgressRange,
	WaistProgressCard,
	WeekCaloriesCard,
	WeightProgressCard,
} from '@/entities/progress'

import { WeightCta } from './WeightCta'

interface ProgressContentProps {
	progress: ProgressResponse
	range: ProgressRange
}

/** Weight (or the invitation to record it), waist (with a hint when there is none), the 7-day week, the insight. */
export const ProgressContent = ({ progress, range }: ProgressContentProps) => {
	const { weight, waist, week, insight, to } = progress

	return (
		<>
			{weight ? <WeightProgressCard weight={weight} range={range} today={to} /> : <WeightCta />}
			<WaistProgressCard waist={waist} range={range} today={to} />
			{week.avgKcal !== null && <WeekCaloriesCard week={week} today={to} />}
			<InsightCard insight={insight} />
		</>
	)
}
