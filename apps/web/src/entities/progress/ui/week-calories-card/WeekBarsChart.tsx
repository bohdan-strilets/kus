import type { ProgressWeekDay } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { cn, formatInteger, formatWeekdayShort, toCalendarDate } from '@/shared/lib'
import { Text } from '@/shared/ui'

import {
	getWeekBars,
	getWeekChartSummary,
	WEEK_CHART_HEIGHT,
	WEEK_CHART_WIDTH,
} from '../../lib/get-week-bars'

export interface WeekBarsChartProps {
	days: readonly ProgressWeekDay[]
	goalKcal: number | null
	/** `YYYY-MM-DD`: its bar is the unfinished day, paler. */
	today: string
}

const PERCENT = 100
const GOAL_DASH = '4 4'
const GOAL_LINE_WIDTH = 1.5
const BASELINE_WIDTH = 1

/**
 * Seven bars in plain SVG on the tokens (docs Charts: primary, rounded 4 at the top, today paler,
 * a dashed goal line). An over day is the `over` family, and the goal line shows where the goal
 * is, so colour is not the only carrier. Weekday labels are HTML: they stay 12px and readable.
 */
export const WeekBarsChart = ({ days, goalKcal, today }: WeekBarsChartProps) => {
	const { t } = useTranslation()
	const { bars, goalY, maxIndex } = getWeekBars({ days, goalKcal, today })
	const maxBar = maxIndex === null ? undefined : bars[maxIndex]
	const label = getWeekChartSummary({ days, today })
		.map((part) => {
			if (part.key === 'progress.week.chart.range') {
				return t(part.key, { min: formatInteger(part.min), max: formatInteger(part.max) })
			}
			return t(part.key, { value: formatInteger(part.value) })
		})
		.join(', ')

	return (
		<div className="flex flex-col gap-1">
			<div className="relative mt-4 h-24">
				<svg
					role="img"
					aria-label={label}
					viewBox={`0 0 ${WEEK_CHART_WIDTH} ${WEEK_CHART_HEIGHT}`}
					preserveAspectRatio="none"
					className="absolute inset-0 size-full"
				>
					{goalY !== null && (
						<line
							x1={0}
							x2={WEEK_CHART_WIDTH}
							y1={goalY}
							y2={goalY}
							strokeWidth={GOAL_LINE_WIDTH}
							strokeDasharray={GOAL_DASH}
							vectorEffect="non-scaling-stroke"
							className="stroke-muted-soft"
						/>
					)}
					{bars.map((bar) =>
						bar.path ? (
							<path
								key={bar.localDate}
								d={bar.path}
								data-today={bar.isToday || undefined}
								className={cn(
									bar.status === 'over' ? 'fill-over-soft' : 'fill-primary',
									bar.isToday && 'opacity-35',
								)}
							/>
						) : null,
					)}
					<line
						x1={0}
						x2={WEEK_CHART_WIDTH}
						y1={WEEK_CHART_HEIGHT - 0.5}
						y2={WEEK_CHART_HEIGHT - 0.5}
						strokeWidth={BASELINE_WIDTH}
						vectorEffect="non-scaling-stroke"
						className="stroke-handle"
					/>
				</svg>
				{maxBar && (
					<Text
						as="span"
						variant="small"
						weight="bold"
						isTabular
						className="absolute mb-0.5 -translate-x-1/2"
						style={{
							left: `${maxBar.centerRatio * PERCENT}%`,
							bottom: `${maxBar.heightRatio * PERCENT}%`,
						}}
					>
						{formatInteger(maxBar.kcal)}
					</Text>
				)}
			</div>
			<div className="grid grid-cols-7">
				{bars.map((bar) => (
					<Text
						key={bar.localDate}
						as="span"
						variant="small"
						weight={bar.isToday ? 'bold' : 'regular'}
						tone={bar.isToday ? 'ink' : 'muted'}
						className="text-center"
					>
						{formatWeekdayShort(toCalendarDate(bar.localDate))}
					</Text>
				))}
			</div>
		</div>
	)
}
