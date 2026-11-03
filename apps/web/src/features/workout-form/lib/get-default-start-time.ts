const MIN_IN_HOUR = 60
const MIN_IN_DAY = 24 * MIN_IN_HOUR

const pad = (value: number): string => String(value).padStart(2, '0')

/**
 * The start the form proposes: «now» minus the duration, so the end is not in the future. A
 * duration that reaches back past midnight stops at 00:00. No duration yet: «now».
 */
export const getDefaultStartTime = (now: string, durationMin: number | null): string => {
	if (durationMin === null || durationMin <= 0) return now
	const [hours = 0, minutes = 0] = now.split(':').map(Number)
	const total = Math.min(MIN_IN_DAY - 1, Math.max(0, hours * MIN_IN_HOUR + minutes - durationMin))
	return `${pad(Math.floor(total / MIN_IN_HOUR))}:${pad(total % MIN_IN_HOUR)}`
}
