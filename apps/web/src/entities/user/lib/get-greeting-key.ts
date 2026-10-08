export type GreetingKey = 'chat.greeting.morning' | 'chat.greeting.day' | 'chat.greeting.evening'

/** [from, to) local hours; the night (22–4) keeps «Добрий вечір». */
const MORNING = { from: 4, to: 12 }
const DAY = { from: 12, to: 18 }

/** «Доброго ранку / Добрий день / Добрий вечір» by the user's local hour. */
export const getGreetingKey = (hour: number): GreetingKey => {
	if (hour >= MORNING.from && hour < MORNING.to) return 'chat.greeting.morning'
	if (hour >= DAY.from && hour < DAY.to) return 'chat.greeting.day'
	return 'chat.greeting.evening'
}
