import { z } from 'zod'

export const STATS_CARD_VERSION = 1

export const statsPeriodSchema = z.enum(['week', 'month'])

export type StatsPeriod = z.infer<typeof statsPeriodSchema>

/** Days in a period, ending on its last day. */
export const STATS_PERIOD_DAYS: Record<StatsPeriod, number> = { week: 7, month: 30 }

/**
 * A period as Kusik showed it when answering show_stats: a snapshot, never refreshed. Everything is
 * counted by the backend. The period may end today, like on «Прогрес».
 */
export const statsCardSchema = z.object({
	version: z.literal(STATS_CARD_VERSION),
	period: statsPeriodSchema,
	/** `YYYY-MM-DD`, first and last day of the period (the last is never later than today). */
	from: z.iso.date(),
	to: z.iso.date(),
	/** Days of the period with something logged; the averages and `daysInNorm` are over them. */
	loggedDays: z.int().nonnegative(),
	/** Of `loggedDays`: days that closed on the goal (not over it, not far below it). */
	daysInNorm: z.int().nonnegative(),
	avgKcal: z.number().nullable(),
	avgProteinG: z.number().nullable(),
	/** The goal in force on the last day; null without one. */
	goalKcal: z.number().nullable(),
	/** Last weight of the period minus the first, kg; null with fewer than two weigh-ins. */
	weightChangeKg: z.number().nullable(),
})

export type StatsCard = z.infer<typeof statsCardSchema>
