import { useTranslation } from 'react-i18next'

import { formatNumber } from '@/entities/workout'
import { formatDayMonthShort, toCalendarDate } from '@/shared/lib'
import { Sparkline, Text } from '@/shared/ui'

import type { ExerciseSeries } from '../lib/exercise-view'
import type { ExerciseMetric } from '../lib/training-exercise.constants'

interface ExerciseChartProps {
	series: ExerciseSeries
	metric: ExerciseMetric
	isBodyweight: boolean
	/** «місяць», for the spoken name of the chart. */
	periodName: string
}

const getHintKey = (
	metric: ExerciseMetric,
	isBodyweight: boolean,
):
	| 'training.stats.exercise.progress.hintBodyweight'
	| 'training.stats.exercise.progress.hintWeight'
	| 'training.stats.exercise.progress.hintReps' => {
	if (isBodyweight) return 'training.stats.exercise.progress.hintBodyweight'
	return metric === 'weight'
		? 'training.stats.exercise.progress.hintWeight'
		: 'training.stats.exercise.progress.hintReps'
}

/** The line of the chosen metric: first and last value above it, first and last date under it. */
export const ExerciseChart = ({ series, metric, isBodyweight, periodName }: ExerciseChartProps) => {
	const { t } = useTranslation()
	const { values, firstDate, lastDate } = series
	const first = values[0]
	const last = values[values.length - 1]
	if (first === undefined || last === undefined || firstDate === null || lastDate === null)
		return null

	return (
		<div className="flex flex-col gap-2">
			<Sparkline
				values={values}
				label={t(`training.stats.exercise.progress.aria.${metric}`, { period: periodName })}
				marks={{ first: formatNumber(first), last: formatNumber(last), endDot: 'lg' }}
				className="h-24"
			/>
			<div className="flex justify-between">
				<Text as="span" variant="small" tone="muted">
					{formatDayMonthShort(toCalendarDate(firstDate))}
				</Text>
				<Text as="span" variant="small" tone="muted">
					{formatDayMonthShort(toCalendarDate(lastDate))}
				</Text>
			</div>
			<Text variant="small" tone="muted">
				{t(getHintKey(metric, isBodyweight))}
			</Text>
		</div>
	)
}
