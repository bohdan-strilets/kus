import { shiftLocalDate } from '@/shared/lib'

import { DAYS_IN_WEEK, TRAINING_WEEKS } from './training.constants'

/** [from, to] of the tab, both `YYYY-MM-DD` in the user's zone: the last eight weeks up to today. */
export const getTrainingRange = (today: string): { from: string; to: string } => ({
	from: shiftLocalDate(today, 1 - TRAINING_WEEKS * DAYS_IN_WEEK),
	to: today,
})
