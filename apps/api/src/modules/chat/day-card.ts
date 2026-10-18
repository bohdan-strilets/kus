import { type DayCard, dayCardSchema } from '@kus/shared'

export interface StoredDayCard {
	card: DayCard | null
	/** true when something was stored but no longer reads as a day card. */
	isUnreadable: boolean
}

/** The snapshot as stored in `messages.day_card`; a value that doesn't parse reads as no card. */
export const readStoredDayCard = (value: unknown): StoredDayCard => {
	if (value === null || value === undefined) return { card: null, isUnreadable: false }
	const parsed = dayCardSchema.safeParse(value)
	return parsed.success
		? { card: parsed.data, isUnreadable: false }
		: { card: null, isUnreadable: true }
}
