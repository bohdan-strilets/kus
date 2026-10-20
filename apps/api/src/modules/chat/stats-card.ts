import { type StatsCard, statsCardSchema } from '@kus/shared'

export interface StoredStatsCard {
	card: StatsCard | null
	/** true when something was stored but no longer reads as a stats card. */
	isUnreadable: boolean
}

/** The snapshot as stored in `messages.stats_card`; a value that doesn't parse reads as no card. */
export const readStoredStatsCard = (value: unknown): StoredStatsCard => {
	if (value === null || value === undefined) return { card: null, isUnreadable: false }
	const parsed = statsCardSchema.safeParse(value)
	return parsed.success
		? { card: parsed.data, isUnreadable: false }
		: { card: null, isUnreadable: true }
}
