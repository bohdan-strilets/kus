import { z } from 'zod'

import { dayVerdictSchema } from './day-verdict.js'

export const STATS_CARD_VERSION = 1

export const statsPeriodSchema = z.enum(['week', 'month'])

export type StatsPeriod = z.infer<typeof statsPeriodSchema>

/** Days in a period, ending on its last day. */
/** Fewer logged days than this and the card says there is too little data to judge the period. */
export const STATS_CARD_MIN_LOGGED_DAYS = 3

export const STATS_PERIOD_DAYS: Record<StatsPeriod, number> = { week: 7, month: 30 }

export const statsCardDaySchema = z.object({
	/** `YYYY-MM-DD` */
	date: z.iso.date(),
	kcal: z.number(),
	/** Against the goal in force that day; no_goal without one. */
	verdict: dayVerdictSchema,
})

export type StatsCardDay = z.infer<typeof statsCardDaySchema>

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
	/**
	 * Of `loggedDays`: days not over the goal, as on «Прогрес»; a day far below it (`far_under`) and a
	 * day without a goal count too.
	 */
	daysInNorm: z.int().nonnegative(),
	avgKcal: z.number().nullable(),
	avgProteinG: z.number().nullable(),
	/** The goal in force on the last day; null without one. */
	goalKcal: z.number().nullable(),
	/** Last weight of the period minus the first, kg; null with fewer than two weigh-ins. */
	weightChangeKg: z.number().nullable(),
	/** The protein goal in force on the last day; null without a goal. Absent in older snapshots. */
	proteinGoalG: z.number().nullable().default(null),
	/** First and last weigh-in of the period, kg; null with fewer than two. Absent in older snapshots. */
	weightStartKg: z.number().nullable().default(null),
	weightEndKg: z.number().nullable().default(null),
	/** Days of the period with something logged, oldest first. Absent (empty) in older snapshots. */
	days: z.array(statsCardDaySchema).default([]),
})

export type StatsCard = z.infer<typeof statsCardSchema>
