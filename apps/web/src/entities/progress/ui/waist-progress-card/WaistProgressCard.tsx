import type { ProgressWaist } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import {
	formatMeasurement,
	formatMeasurementDelta,
	formatMeasurementNumber,
} from '@/entities/measurement'
import { formatDayMonthShort, toCalendarDate } from '@/shared/lib'
import { Sparkline, Surface, Text } from '@/shared/ui'

import type { ProgressRange } from '../../model/progress.types'

export interface WaistProgressCardProps {
	waist: ProgressWaist
	range: ProgressRange
	/** `YYYY-MM-DD`, the last day of the range: the last chart label says «сьогодні» on it. */
	today: string
}

/**
 * mockups/progress.html «Талія»: the latest waist, the change over the chosen period and a compact
 * chart. With no measurement in the period the chart and the change give way to one honest line.
 */
export const WaistProgressCard = ({ waist, range, today }: WaistProgressCardProps) => {
	const { t } = useTranslation()
	const { current, changeInRange, points } = waist
	const first = points[0]
	const last = points[points.length - 1]
	const hasHistory = points.length > 1
	const isLastToday = last?.localDate === today
	const chartLabel =
		hasHistory && first && last
			? t('progress.waist.chartLabel', {
					days: range,
					from: formatMeasurement(first.value, 'WAIST', t),
					to: formatMeasurement(last.value, 'WAIST', t),
				})
			: t('measurement.chart.single.WAIST', {
					value: formatMeasurement(last?.value ?? current.value, 'WAIST', t),
				})

	return (
		<Surface variant="list" radius="panel" className="flex flex-col gap-2.5 p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="flex flex-col gap-0.5">
					<Text as="span" variant="caption" tone="muted">
						{t('progress.waist.label')}
					</Text>
					<Text as="span" weight="extrabold" isTabular className="text-screen-title">
						{formatMeasurementNumber(current.value, 'WAIST')}{' '}
						<Text as="span" variant="body" weight="semibold" tone="muted">
							{t('progress.waist.unit')}
						</Text>
					</Text>
				</div>
				{hasHistory && changeInRange !== null && (
					<span className="rounded-badge bg-success-soft px-2.5 py-1 text-caption font-extrabold text-success-ink tabular-nums">
						{formatMeasurementDelta(changeInRange, 'WAIST', t)}
					</span>
				)}
			</div>

			{first && last ? (
				<div className="flex flex-col gap-1">
					<Sparkline
						values={points.map((point) => point.value)}
						label={chartLabel}
						marks={{ first: formatMeasurementNumber(first.value, 'WAIST'), endDot: 'sm' }}
						className="h-17.5"
					/>
					<div className="flex justify-between text-small text-muted tabular-nums">
						<span>{formatDayMonthShort(toCalendarDate(first.localDate))}</span>
						{(hasHistory || isLastToday) && (
							<span className="ml-auto">
								{isLastToday
									? t('measurement.chart.today')
									: formatDayMonthShort(toCalendarDate(last.localDate))}
							</span>
						)}
					</div>
				</div>
			) : (
				<Text variant="caption" weight="regular" tone="muted">
					{t('progress.waist.empty')}
				</Text>
			)}
		</Surface>
	)
}
