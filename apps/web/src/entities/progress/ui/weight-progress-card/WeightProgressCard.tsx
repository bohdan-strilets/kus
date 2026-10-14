import type { ProgressWeight } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import {
	formatMeasurement,
	formatMeasurementDelta,
	formatMeasurementNumber,
	formatTargetWeight,
} from '@/entities/measurement'
import { formatDayMonthShort, toCalendarDate } from '@/shared/lib'
import { Sparkline, Surface, Text } from '@/shared/ui'

import type { ProgressRange } from '../../model/progress.types'

export interface WeightProgressCardProps {
	weight: ProgressWeight
	range: ProgressRange
	/** `YYYY-MM-DD`, the last day of the range: the last chart label says «сьогодні» on it. */
	today: string
}

/**
 * mockups/progress.html «Вага»: the current weight, the change over the chosen period, the goal
 * and the chart. With no weigh-in in the period the chart and the change are replaced by one
 * honest line; every number is the backend's.
 */
export const WeightProgressCard = ({ weight, range, today }: WeightProgressCardProps) => {
	const { t } = useTranslation()
	const { current, changeInRange, points, target, toGoal, isGoalReached } = weight
	const first = points[0]
	const last = points[points.length - 1]
	const hasPoints = first !== undefined && last !== undefined
	const hasHistory = points.length > 1
	const chartLabel =
		hasHistory && first && last
			? t('progress.weight.chartLabel', {
					days: range,
					from: formatMeasurement(first.value, 'WEIGHT', t),
					to: formatMeasurement(last.value, 'WEIGHT', t),
				})
			: t('measurement.chart.single.WEIGHT', {
					value: formatMeasurement(last?.value ?? current.value, 'WEIGHT', t),
				})
	const isLastToday = last?.localDate === today
	const lastLabel = isLastToday
		? t('measurement.chart.today')
		: formatDayMonthShort(toCalendarDate(last?.localDate ?? current.localDate))
	const goalCaption = (): string | null => {
		if (isGoalReached === true) return t('measurement.goalReached')
		if (target === null) return null
		const targetText = formatTargetWeight(target, t)
		return toGoal === null || toGoal <= 0
			? t('progress.weight.target', { target: targetText })
			: t('progress.weight.targetLeft', {
					target: targetText,
					left: formatMeasurement(toGoal, 'WEIGHT', t),
				})
	}
	const caption = goalCaption()

	return (
		<Surface variant="list" radius="panel" className="flex flex-col gap-2.5 p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="flex flex-col gap-0.5">
					<Text as="span" variant="caption" tone="muted">
						{t('progress.weight.label')}
					</Text>
					<Text as="span" variant="bigNumber">
						{formatMeasurementNumber(current.value, 'WEIGHT')}{' '}
						<Text as="span" variant="body" weight="semibold" tone="muted">
							{t('progress.weight.unit')}
						</Text>
					</Text>
				</div>
				<div className="flex flex-col items-end gap-1 text-right">
					{hasHistory && changeInRange !== null && (
						<span className="rounded-badge bg-success-soft px-2.5 py-1 text-caption font-extrabold text-success-ink tabular-nums">
							{formatMeasurementDelta(changeInRange, 'WEIGHT', t)}
						</span>
					)}
					{caption && (
						<Text as="span" variant="small" weight="regular" tone="muted">
							{caption}
						</Text>
					)}
				</div>
			</div>

			{hasPoints ? (
				<div className="flex flex-col gap-1">
					<Sparkline
						values={points.map((point) => point.value)}
						reference={target ?? undefined}
						marks={{
							first: formatMeasurementNumber(first.value, 'WEIGHT'),
							last: formatMeasurementNumber(last.value, 'WEIGHT'),
							endDot: 'lg',
						}}
						label={chartLabel}
						className="h-28"
					/>
					<div className="flex justify-between text-small text-muted tabular-nums">
						<span>{formatDayMonthShort(toCalendarDate(first.localDate))}</span>
						{(hasHistory || isLastToday) && <span className="ml-auto">{lastLabel}</span>}
					</div>
				</div>
			) : (
				<Text variant="caption" weight="regular" tone="muted">
					{t('progress.noWeighIns')}
				</Text>
			)}
		</Surface>
	)
}
