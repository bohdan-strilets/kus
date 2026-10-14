import type { ProgressWeekDay } from '@kus/shared'

export const WEEK_CHART_WIDTH = 314
export const WEEK_CHART_HEIGHT = 96
/** Tallest possible bar: the rest is room for the baseline. */
const PLOT_HEIGHT = 90
const BASELINE_Y = 95
const BAR_WIDTH = 26
const BAR_RADIUS = 4

export interface WeekBar {
	localDate: string
	kcal: number
	status: ProgressWeekDay['status']
	isToday: boolean
	/** A finished day over the goal: the part above the goal line is drawn again in `over`. Today never is. */
	hasOverCap: boolean
	/** Nothing eaten that day: no bar. */
	hasBar: boolean
	/** Rounded-top bar in viewBox units; null without a bar. */
	path: string | null
	/** Bar centre as a share of the chart width, 0..1 (the label above the tallest bar). */
	centerRatio: number
	/** Bar height as a share of the chart height, 0..1. */
	heightRatio: number
}

export interface WeekBars {
	bars: WeekBar[]
	/** Dashed goal line, as a y in viewBox units; null without a goal. */
	goalY: number | null
	/** Index of the tallest bar (the first of equals); null when no day has food. */
	maxIndex: number | null
}

const getBarPath = (x: number, height: number): string => {
	const radius = Math.min(BAR_RADIUS, height)
	const top = BASELINE_Y - height
	return `M${x.toFixed(1)} ${BASELINE_Y} V${(top + radius).toFixed(1)} a${radius} ${radius} 0 0 1 ${radius} -${radius} h${BAR_WIDTH - 2 * radius} a${radius} ${radius} 0 0 1 ${radius} ${radius} V${BASELINE_Y} Z`
}

/**
 * Seven bars on one scale: the taller of the largest day and the goal fills the plot, so the goal
 * line never leaves the chart. Pure geometry — the numbers are the backend's.
 */
export const getWeekBars = ({
	days,
	goalKcal,
	today,
}: {
	days: readonly ProgressWeekDay[]
	goalKcal: number | null
	today: string
}): WeekBars => {
	const maxKcal = Math.max(0, ...days.map((day) => day.kcal))
	const scaleMax = Math.max(maxKcal, goalKcal ?? 0)
	const column = WEEK_CHART_WIDTH / Math.max(days.length, 1)
	const bars = days.map((day, index): WeekBar => {
		const hasBar = day.kcal > 0 && scaleMax > 0
		const height = hasBar ? (day.kcal / scaleMax) * PLOT_HEIGHT : 0
		const x = index * column + (column - BAR_WIDTH) / 2
		return {
			localDate: day.localDate,
			kcal: day.kcal,
			status: day.status,
			isToday: day.localDate === today,
			hasBar,
			hasOverCap: hasBar && day.status === 'over' && day.localDate !== today,
			path: hasBar ? getBarPath(x, height) : null,
			centerRatio: (x + BAR_WIDTH / 2) / WEEK_CHART_WIDTH,
			heightRatio: height / WEEK_CHART_HEIGHT,
		}
	})
	const goalY =
		goalKcal !== null && goalKcal > 0 && scaleMax > 0
			? BASELINE_Y - (goalKcal / scaleMax) * PLOT_HEIGHT
			: null
	const maxIndex = maxKcal > 0 ? days.findIndex((day) => day.kcal === maxKcal) : null
	return { bars, goalY, maxIndex }
}

export type WeekChartSummaryPart =
	| { key: 'progress.week.chart.range'; min: number; max: number }
	| { key: 'progress.week.chart.single'; value: number }
	| { key: 'progress.week.chart.overDays'; count: number }
	| { key: 'progress.week.chart.todaySoFar'; value: number }
	| { key: 'progress.week.chart.todayOnly'; value: number }

/**
 * What the chart says in words: the range over the finished days and today so far — the
 * mockup's «від 1 980 до 2 420, сьогодні поки 1 370».
 */
export const getWeekChartSummary = ({
	days,
	today,
}: {
	days: readonly ProgressWeekDay[]
	today: string
}): WeekChartSummaryPart[] => {
	const past = days.filter((day) => day.localDate !== today && day.kcal > 0).map((day) => day.kcal)
	const todayKcal = days.find((day) => day.localDate === today)?.kcal ?? 0
	const min = Math.min(...past)
	const max = Math.max(...past)
	const parts: WeekChartSummaryPart[] = []
	if (past.length === 0) {
		if (todayKcal > 0) parts.push({ key: 'progress.week.chart.todayOnly', value: todayKcal })
		return parts
	}
	parts.push(
		min === max
			? { key: 'progress.week.chart.single', value: min }
			: { key: 'progress.week.chart.range', min, max },
	)
	const overDays = days.filter((day) => day.localDate !== today && day.status === 'over').length
	if (overDays > 0) parts.push({ key: 'progress.week.chart.overDays', count: overDays })
	if (todayKcal > 0) parts.push({ key: 'progress.week.chart.todaySoFar', value: todayKcal })
	return parts
}
