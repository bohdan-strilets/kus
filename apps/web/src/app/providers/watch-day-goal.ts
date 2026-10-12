import { type AuthUser, dayResponseSchema } from '@kus/shared'
import type { QueryClient } from '@tanstack/react-query'

import { DAY_QUERY_KEY } from '@/entities/day'
import { SESSION_QUERY_KEY } from '@/entities/session'
import {
	detectGoalReached,
	getGaugeState,
	type GaugeStatus,
	hasCelebratedGoal,
	useGoalCelebrationStore,
} from '@/entities/stats'
import { getLocalDateString } from '@/shared/lib'

const DAY_KEY_LENGTH = 2

/** Only ['day', <date>]; the week strip's ['day', 'range', from, to] is not a single day. */
const getDayQueryDate = (queryKey: unknown): string | null => {
	if (!Array.isArray(queryKey)) return null
	if (queryKey.length !== DAY_KEY_LENGTH || queryKey[0] !== DAY_QUERY_KEY[0]) return null
	const date: unknown = queryKey[1]
	return typeof date === 'string' ? date : null
}

/**
 * Looks at every fresh «day» the server returns and notes the moment the calorie goal closes
 * (under → closed) after the user's own action. It only detects: the celebration itself
 * consumes the pending goal and writes the «already celebrated» flag.
 */
export const watchDayGoal = (queryClient: QueryClient): (() => void) => {
	// the last seen status of today: a first observation is never a celebration
	const baseline = new Map<string, GaugeStatus>()
	let baselineOwnerId: string | null = null

	return queryClient.getQueryCache().subscribe((event) => {
		if (event.type !== 'updated' || event.action.type !== 'success') return
		const date = getDayQueryDate(event.query.queryKey)
		if (date === null) return
		const user = queryClient.getQueryData<AuthUser | null>(SESSION_QUERY_KEY)
		if (!user) return
		if (baselineOwnerId !== user.id) {
			baseline.clear()
			baselineOwnerId = user.id
		}
		const parsed = dayResponseSchema.safeParse(event.query.state.data)
		if (!parsed.success) return

		const today = getLocalDateString(new Date(), user.timezone)
		// only today can be celebrated: other dates would just pile up in the map
		for (const key of baseline.keys()) {
			if (key !== today) baseline.delete(key)
		}
		if (date !== today) return

		const { goal, totals } = parsed.data
		if (goal === null) {
			baseline.delete(date)
			return
		}
		const nextStatus = getGaugeState(totals.kcal, goal.kcal).status
		const previousStatus = baseline.get(date) ?? null
		baseline.set(date, nextStatus)

		const isReached = detectGoalReached({
			previousStatus,
			nextStatus,
			hasGoal: true,
			isArmed: useGoalCelebrationStore.getState().isArmed(),
			localDate: date,
			today,
		})
		if (isReached && !hasCelebratedGoal(user.id, date)) {
			useGoalCelebrationStore.getState().setPending(date)
		}
	})
}
