export type GreetingKey =
	'chat.greeting.morning' | 'chat.greeting.day' | 'chat.greeting.evening' | 'chat.greeting.night'

/** Local-hour boundaries; the night [EVENING_END, MORNING_START) wraps over midnight. */
const MORNING_START = 5
const DAY_START = 12
const EVENING_START = 18
const EVENING_END = 23

/** «Доброго ранку / Добрий день / Добрий вечір / Привіт» by the user's local hour. */
export const getGreetingKey = (hour: number): GreetingKey => {
	if (hour >= MORNING_START && hour < DAY_START) return 'chat.greeting.morning'
	if (hour >= DAY_START && hour < EVENING_START) return 'chat.greeting.day'
	if (hour >= EVENING_START && hour < EVENING_END) return 'chat.greeting.evening'
	return 'chat.greeting.night'
}
