import { isWorkoutOpen, type LiveWorkoutResponse } from '@kus/shared'

const toMs = (iso: string | null): number | null => {
	if (iso === null) return null
	const ms = new Date(iso).getTime()
	return Number.isNaN(ms) ? null : ms
}

/**
 * When the person last did something in the session: the newest of its sets' `doneAt`, the
 * exercises' `performedAt` and the session's `startedAt`. Null when none of them is known.
 */
export const getLastLiveActionAt = (live: LiveWorkoutResponse): Date | null => {
	const { workout } = live
	const times = [
		toMs(workout.startedAt),
		...workout.exercises.flatMap((exercise) => [
			toMs(exercise.performedAt),
			...exercise.sets.map((set) => toMs(set.doneAt)),
		]),
	].filter((ms): ms is number => ms !== null)
	if (times.length === 0) return null
	return new Date(Math.max(...times))
}

/** The session was touched within the server's open window (3 h): the API still keeps it open. */
export const isLiveFresh = (live: LiveWorkoutResponse, now: Date): boolean => {
	const last = getLastLiveActionAt(live)
	return last !== null && isWorkoutOpen(last, now)
}
