import type { WorkoutResponse } from '@kus/shared'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { workoutsRangeQueryOptions } from '@/entities/workout'
import { shiftLocalDate } from '@/shared/lib'

import { getTrainingRange } from '../lib/get-training-range'
import { getWeekMonday, getWeekSummary, type WeekSummary } from '../lib/get-week-summary'
import { DAYS_IN_WEEK } from '../lib/training.constants'

export interface TrainingWeekState {
	/** Null while the week loads. */
	summary: WeekSummary | null
	isCurrent: boolean
	isError: boolean
	retry: () => void
	showPrevious: () => void
	/** Null at the current week: the strip does not go forward from it. */
	showNext: (() => void) | null
}

interface TrainingWeekInput {
	today: string
	/** What the journal already read (the last weeks); undefined while it loads. */
	journal: readonly WorkoutResponse[] | undefined
}

/**
 * The week of the strip: the current one by default, ‹ goes back by a week, › returns. A week the
 * journal already covers is cut from its data; an older one is read with its own range.
 */
export const useTrainingWeek = ({ today, journal }: TrainingWeekInput): TrainingWeekState => {
	const [weeksBack, setWeeksBack] = useState(0)
	const weekStart = shiftLocalDate(getWeekMonday(today), -DAYS_IN_WEEK * weeksBack)
	const weekEnd = shiftLocalDate(weekStart, DAYS_IN_WEEK - 1)
	const isCovered = weekStart >= getTrainingRange(today).from
	const query = useQuery({
		...workoutsRangeQueryOptions({ from: weekStart, to: weekEnd }),
		enabled: !isCovered,
	})
	const workouts = isCovered ? journal : query.data

	return {
		summary: workouts ? getWeekSummary(workouts, weekStart) : null,
		isCurrent: weeksBack === 0,
		isError: !isCovered && query.isError,
		retry: () => void query.refetch(),
		showPrevious: () => {
			setWeeksBack((current) => current + 1)
		},
		showNext:
			weeksBack > 0
				? () => {
						setWeeksBack((current) => Math.max(0, current - 1))
					}
				: null,
	}
}
