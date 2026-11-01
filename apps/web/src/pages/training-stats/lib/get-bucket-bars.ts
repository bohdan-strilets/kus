import type { WorkoutStatsPeriod } from '@kus/shared'

import type { BarChartBar } from '@/shared/ui'
import { formatShortDate, formatWeekdayShort, toCalendarDate } from '@/shared/lib'

/** «Пн» for a day column, «22.09» (the Monday) for a week column. */
export const getBucketLabel = (from: string, period: WorkoutStatsPeriod): string => {
	const date = toCalendarDate(from)
	return period === 'week' ? formatWeekdayShort(date) : formatShortDate(date)
}

export interface BucketBarsOptions {
	buckets: readonly { from: string }[]
	period: WorkoutStatsPeriod
	values: readonly number[]
	/** Spoken form of one bar; the screen reader reads every bar even when its caption is thinned out. */
	describe: (label: string, value: number) => string
}

/** One bar per bucket; BarChart thins the captions out itself. */
export const getBucketBars = ({
	buckets,
	period,
	values,
	describe,
}: BucketBarsOptions): BarChartBar[] =>
	buckets.map((bucket, index) => {
		const label = getBucketLabel(bucket.from, period)
		const value = values[index] ?? 0
		return { label, value, ariaLabel: describe(label, value) }
	})
