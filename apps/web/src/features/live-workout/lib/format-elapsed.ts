const MS_IN_SECOND = 1000
const SECONDS_IN_MINUTE = 60
const MINUTES_IN_HOUR = 60

const pad = (value: number): string => String(value).padStart(2, '0')

/** «23:14» since the start, «1:05:09» after an hour; «00:00» without a start or before it. */
export const formatElapsed = (startedAt: string | null, now: Date): string => {
	const totalSeconds =
		startedAt === null
			? 0
			: Math.max(0, Math.floor((now.getTime() - new Date(startedAt).getTime()) / MS_IN_SECOND))
	const totalMinutes = Math.floor(totalSeconds / SECONDS_IN_MINUTE)
	const seconds = totalSeconds % SECONDS_IN_MINUTE
	const hours = Math.floor(totalMinutes / MINUTES_IN_HOUR)
	const minutes = totalMinutes % MINUTES_IN_HOUR
	return hours > 0
		? `${hours}:${pad(minutes)}:${pad(seconds)}`
		: `${pad(totalMinutes)}:${pad(seconds)}`
}
