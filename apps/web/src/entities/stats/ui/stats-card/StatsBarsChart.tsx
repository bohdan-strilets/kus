import { useTranslation } from 'react-i18next'

import { cn, formatShortDate, formatWeekdayShort, toCalendarDate } from '@/shared/lib'
import { Text } from '@/shared/ui'

import { STATS_BARS_GOAL_PX, type StatsBar, type StatsBars } from '../../lib/get-stats-bars'
import { statsBarVariants } from './stats-bar.variants'

interface StatsBarsChartProps {
	bars: StatsBars
	/** `YYYY-MM-DD`: the first and the last day of the period, for the labels at the ends. */
	from: string
	to: string
}

interface BarProps {
	bar: StatsBar
	width: StatsBars['width']
}

const Bar = ({ bar, width }: BarProps) => (
	<div className="flex h-14 min-w-0 flex-1 items-end justify-center">
		{bar.heightPx === 0 ? (
			<div className={cn(statsBarVariants({ width }), 'h-1 bg-muted-soft/40')} />
		) : (
			<div
				className={cn(statsBarVariants({ width }), 'flex flex-col', bar.isPartial && 'opacity-50')}
				style={{ height: bar.heightPx }}
			>
				{bar.overPx > 0 && <div className="shrink-0 bg-over" style={{ height: bar.overPx }} />}
				<div className="flex-1 bg-success" />
			</div>
		)}
	</div>
)

/**
 * The bars of a stats card (mockups/chat-stats-period.html): a day or a week per bar, the goal as a
 * dashed line, the part over the goal in `over` (data, not an error).
 */
export const StatsBarsChart = ({ bars, from, to }: StatsBarsChartProps) => {
	const { t } = useTranslation()
	const { mode, width, hasGoalLine } = bars
	const label = t(mode === 'weekly' ? 'chat.statsCard.chartWeeks' : 'chat.statsCard.chartDays')
	const gap = mode === 'daily' ? 'gap-0.5' : 'gap-1'

	return (
		<div className="flex flex-col gap-1 rounded-tile bg-field px-2 pt-2.5 pb-2">
			<div role="img" aria-label={label} className={cn('relative flex', gap)}>
				{hasGoalLine && (
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted-soft"
						style={{ bottom: STATS_BARS_GOAL_PX }}
					/>
				)}
				{bars.bars.map((bar) => (
					<Bar key={bar.date} bar={bar} width={width} />
				))}
			</div>
			{mode === 'labeled' ? (
				<div className={cn('flex', gap)}>
					{bars.bars.map(({ date }) => (
						<Text key={date} as="span" variant="small" tone="muted" className="flex-1 text-center">
							{formatWeekdayShort(toCalendarDate(date))}
						</Text>
					))}
				</div>
			) : (
				<div className="flex justify-between">
					<Text as="span" variant="small" weight="regular" tone="muted">
						{formatShortDate(toCalendarDate(from))}
					</Text>
					<Text as="span" variant="small" weight="regular" tone="muted">
						{formatShortDate(toCalendarDate(to))}
					</Text>
				</div>
			)}
			{mode === 'weekly' && (
				<Text as="p" variant="small" weight="regular" tone="muted" className="text-center">
					{t('chat.statsCard.weeklyCaption')}
				</Text>
			)}
		</div>
	)
}
