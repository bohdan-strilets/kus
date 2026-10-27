import type { StatsCard } from '@kus/shared'

const MS_IN_DAY = 24 * 60 * 60 * 1000
const DAYS_IN_WEEK = 7
const MONDAY_INDEX = 1

/** Up to this many days the bars carry weekday labels; from the next day on the labels sit at the ends. */
const LABELED_MAX_DAYS = 7
/** Up to this many days a bar is one day; a longer period is shown by week. */
const DAILY_MAX_DAYS = 31
/** Up to this many days a daily bar is 12 px wide, after that 6 px. */
const MEDIUM_BARS_MAX_DAYS = 15
/** Up to this many weekly bars they are 18 px wide, after that 14 px. */
const WEEKLY_WIDE_BARS_MAX = 9

/** The bar area is 56 px high, a goal-high bar is 45 px (the dashed line sits there). */
export const STATS_BARS_AREA_PX = 56
export const STATS_BARS_GOAL_PX = 45

export type StatsBarsMode = 'labeled' | 'daily' | 'weekly'
export type StatsBarWidth = 'wide' | 'medium' | 'narrow'

export interface StatsBar {
	/** First day of the bar (`YYYY-MM-DD`): the key and the weekday label. */
	date: string
	/** Whole bar height in px; 0 for a day or week without entries (drawn as a short grey dash). */
	heightPx: number
	/** The part of the height above the goal, drawn in the «over» colour. */
	overPx: number
	/** A week the period covers only partly (the edges): half transparent. */
	isPartial: boolean
}

export interface StatsBars {
	mode: StatsBarsMode
	width: StatsBarWidth
	bars: StatsBar[]
	/** The dashed goal line is drawn only with a goal. */
	hasGoalLine: boolean
}

const toUtc = (date: string): number => Date.parse(`${date}T00:00:00Z`)

const addDays = (date: string, count: number): string =>
	new Date(toUtc(date) + count * MS_IN_DAY).toISOString().slice(0, 10)

const getMondayOf = (date: string): string => {
	const weekday = new Date(toUtc(date)).getUTCDay()
	return addDays(date, -((weekday + DAYS_IN_WEEK - MONDAY_INDEX) % DAYS_IN_WEEK))
}

const getTotalDays = (from: string, to: string): number =>
	Math.round((toUtc(to) - toUtc(from)) / MS_IN_DAY) + 1

const getMode = (totalDays: number): StatsBarsMode => {
	if (totalDays <= LABELED_MAX_DAYS) return 'labeled'
	return totalDays <= DAILY_MAX_DAYS ? 'daily' : 'weekly'
}

const getWidth = (mode: StatsBarsMode, totalDays: number, barCount: number): StatsBarWidth => {
	if (mode === 'labeled') return 'wide'
	if (mode === 'weekly') return barCount <= WEEKLY_WIDE_BARS_MAX ? 'wide' : 'medium'
	return totalDays <= MEDIUM_BARS_MAX_DAYS ? 'medium' : 'narrow'
}

const average = (values: readonly number[]): number =>
	values.reduce((sum, value) => sum + value, 0) / values.length

interface BarOptions {
	date: string
	/** The kcal of the day, or of the days with entries of a week. */
	values: readonly number[]
	scaleKcal: number
	hasGoal: boolean
	isPartial: boolean
}

const toBar = ({ date, values, scaleKcal, hasGoal, isPartial }: BarOptions): StatsBar => {
	if (values.length === 0) return { date, heightPx: 0, overPx: 0, isPartial }
	const heightPx = Math.min(
		STATS_BARS_AREA_PX,
		Math.max(1, Math.round((average(values) / scaleKcal) * STATS_BARS_GOAL_PX)),
	)
	const overPx = hasGoal ? Math.max(0, heightPx - STATS_BARS_GOAL_PX) : 0
	return { date, heightPx, overPx, isPartial }
}

const getWeekRanges = (from: string, to: string): { start: string; end: string }[] => {
	const ranges: { start: string; end: string }[] = []
	for (let monday = getMondayOf(from); monday <= to; monday = addDays(monday, DAYS_IN_WEEK)) {
		const sunday = addDays(monday, DAYS_IN_WEEK - 1)
		ranges.push({ start: monday < from ? from : monday, end: sunday > to ? to : sunday })
	}
	return ranges
}

/**
 * The bars under the tiles (mockups/chat-stats-period.html). 2–7 days: a bar per day with weekday
 * labels; 8–31: a bar per day, labels at the ends; 32–92: the mean of a Monday–Sunday week over its
 * days with entries, the weeks cut by the period's edges half transparent. The heights are display
 * only: a goal-high bar is 45 px; without a goal the tallest day sets the scale.
 */
export const getStatsBars = ({ from, to, days, goalKcal }: StatsCard): StatsBars => {
	const totalDays = getTotalDays(from, to)
	const mode = getMode(totalDays)
	const hasGoal = goalKcal !== null && goalKcal > 0
	const scaleKcal = hasGoal ? goalKcal : Math.max(1, ...days.map(({ kcal }) => kcal))
	const common = { scaleKcal, hasGoal }

	if (mode === 'weekly') {
		const bars = getWeekRanges(from, to).map(({ start, end }) =>
			toBar({
				...common,
				date: start,
				values: days.filter(({ date }) => date >= start && date <= end).map(({ kcal }) => kcal),
				isPartial: getTotalDays(start, end) < DAYS_IN_WEEK,
			}),
		)
		return { mode, width: getWidth(mode, totalDays, bars.length), bars, hasGoalLine: hasGoal }
	}

	const kcalByDate = new Map(days.map(({ date, kcal }) => [date, kcal]))
	const bars = Array.from({ length: totalDays }, (_, index) => {
		const date = addDays(from, index)
		const kcal = kcalByDate.get(date)
		return toBar({ ...common, date, values: kcal === undefined ? [] : [kcal], isPartial: false })
	})
	return { mode, width: getWidth(mode, totalDays, bars.length), bars, hasGoalLine: hasGoal }
}
