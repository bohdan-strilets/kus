import type { ProgressWeekDay } from '@kus/shared'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { formatInteger, formatWeekdayShort, toCalendarDate } from '@/shared/lib'
import { Text } from '@/shared/ui'

import {
	getWeekBars,
	type WeekBar,
	getWeekChartSummary,
	WEEK_CHART_HEIGHT,
	WEEK_CHART_WIDTH,
} from '../../lib/get-week-bars'

export interface WeekBarsChartProps {
	days: readonly ProgressWeekDay[]
	goalKcal: number | null
	/** `YYYY-MM-DD`: its bar is the unfinished day, outlined and empty. */
	today: string
}

const PERCENT = 100
const GOAL_DASH = '4 4'
const GOAL_LINE_WIDTH = 1.5
const BASELINE_WIDTH = 1
const TODAY_DASH = '3 3'
const TODAY_OUTLINE_WIDTH = 1.5

interface BarLabelProps {
	bar: WeekBar
	tone: 'ink' | 'muted' | 'overInk'
	weight: 'bold' | 'regular'
}

/** The value above a bar; the chart's aria-label already reads it. The position is dynamic, so it is the one inline style. */
const BarLabel = ({ bar, tone, weight }: BarLabelProps) => (
	<Text
		as="span"
		variant="small"
		weight={weight}
		tone={tone}
		isTabular
		aria-hidden="true"
		className="absolute mb-0.5 -translate-x-1/2"
		style={{
			left: `${bar.centerRatio * PERCENT}%`,
			bottom: `${bar.heightRatio * PERCENT}%`,
		}}
	>
		{formatInteger(bar.kcal)}
	</Text>
)

/**
 * Seven bars in plain SVG on the tokens (mockups/progress.html: success bars, a dashed goal line,
 * the part of an over day above the goal solid `over`, today an outlined empty bar with its value
 * above). The goal line shows where the goal is, so colour is not the only carrier. Labels are
 * HTML: they stay 12px and readable.
 */
export const WeekBarsChart = ({ days, goalKcal, today }: WeekBarsChartProps) => {
	const { t } = useTranslation()
	const capId = useId()
	const { bars, goalY, maxIndex } = getWeekBars({ days, goalKcal, today })
	const maxBar = maxIndex === null ? undefined : bars[maxIndex]
	const todayBar = bars.find((bar) => bar.isToday && bar.hasBar)
	const isMaxOver = goalKcal !== null && (maxBar?.kcal ?? 0) > goalKcal
	const summary = getWeekChartSummary({ days, today })
		.map((part) => {
			if (part.key === 'progress.week.chart.range') {
				return t(part.key, { min: formatInteger(part.min), max: formatInteger(part.max) })
			}
			if (part.key === 'progress.week.chart.overDays') return t(part.key, { count: part.count })
			return t(part.key, { value: formatInteger(part.value) })
		})
		.join(', ')
	// a week without food has no summary, but the image still needs a name
	const label = summary === '' ? t('progress.week.chart.empty') : summary

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
					{goalY !== null && (
						<clipPath id={capId}>
							<rect x={0} y={0} width={WEEK_CHART_WIDTH} height={goalY} />
						</clipPath>
					)}
					{bars.map((bar) =>
						bar.path ? (
							<g key={bar.localDate}>
								{bar.isToday ? (
									<path
										d={bar.path}
										data-today="true"
										strokeWidth={TODAY_OUTLINE_WIDTH}
										strokeDasharray={TODAY_DASH}
										vectorEffect="non-scaling-stroke"
										className="fill-track stroke-muted-soft"
									/>
								) : (
									<path d={bar.path} className="fill-success" />
								)}
								{bar.hasOverCap && (
									<path
										d={bar.path}
										data-over-cap="true"
										clipPath={`url(#${capId})`}
										className="fill-over"
									/>
								)}
							</g>
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
				{maxBar && <BarLabel bar={maxBar} tone={isMaxOver ? 'overInk' : 'ink'} weight="bold" />}
				{todayBar && todayBar !== maxBar && (
					<BarLabel bar={todayBar} tone="muted" weight="regular" />
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
