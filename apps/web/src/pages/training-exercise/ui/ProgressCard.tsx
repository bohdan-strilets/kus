import type { ExerciseStatsResponse } from '@kus/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatChange, StatsNote, StatsPanel } from '@/entities/workout'
import { Badge, SegmentedToggle, Text } from '@/shared/ui'

import { getExerciseSeries } from '../lib/exercise-view'
import {
	EXERCISE_METRICS,
	type ExerciseMetric,
	MIN_POINTS_FOR_CHART,
} from '../lib/training-exercise.constants'
import { ExerciseChart } from './ExerciseChart'

interface ProgressCardProps {
	data: ExerciseStatsResponse
}

/** «Прогрес вправи»: the change badge, «Вага / Повтори» (weighted only) and the line chart. */
export const ProgressCard = ({ data }: ProgressCardProps) => {
	const { t } = useTranslation()
	const [chosenMetric, setChosenMetric] = useState<ExerciseMetric>('weight')
	const { isBodyweight } = data.exercise
	const metric: ExerciseMetric = isBodyweight ? 'reps' : chosenMetric
	const hasPoints = data.points.length > 0
	const series = getExerciseSeries(data.points, metric)
	const change = metric === 'weight' ? data.change : data.changeReps
	const changeText = formatChange({ change, isBodyweight: metric === 'reps' }, t)
	const periodName = t(`training.stats.period.short.${data.period}`)

	const renderBody = () => {
		if (!hasPoints)
			return (
				<StatsNote text={t('training.stats.exercise.progress.empty', { period: periodName })} />
			)
		if (series.values.length < MIN_POINTS_FOR_CHART)
			return <StatsNote text={t('training.stats.single.exercise')} />
		return (
			<ExerciseChart
				series={series}
				metric={metric}
				isBodyweight={isBodyweight}
				periodName={periodName}
			/>
		)
	}

	return (
		<StatsPanel
			title={t('training.stats.exercise.progress.title')}
			aside={
				changeText === null ? undefined : (
					<Badge variant="closed">
						{t('training.stats.exercise.progress.change', {
							change: changeText,
							period: periodName,
						})}
					</Badge>
				)
			}
		>
			{isBodyweight ? (
				<Text variant="caption" tone="muted">
					{t('training.stats.exercise.bodyweightOnly')}
				</Text>
			) : (
				hasPoints && (
					<SegmentedToggle
						aria-label={t('training.stats.exercise.metric.aria')}
						value={metric}
						onChange={setChosenMetric}
						options={EXERCISE_METRICS.map((item) => ({
							value: item,
							label: t(`training.stats.exercise.metric.${item}`),
						}))}
						className="self-start"
					/>
				)
			)}
			{renderBody()}
		</StatsPanel>
	)
}
