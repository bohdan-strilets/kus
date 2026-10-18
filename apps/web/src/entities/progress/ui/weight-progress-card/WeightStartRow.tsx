import type { ProgressWeight } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { formatMeasurement, formatMeasurementDelta } from '@/entities/measurement'
import { formatDayMonthShort, toCalendarDate } from '@/shared/lib'
import { Text } from '@/shared/ui'

interface WeightStartRowProps {
	start: NonNullable<ProgressWeight['start']>
	/** Null when the start is the current weight: there is nothing to compare. */
	fromStart: number | null
	/** `YYYY-MM-DD`: a start of this day says «сьогодні». */
	today: string
}

/** mockups/progress.html: «Старт 85,0 кг · 28 серп» and «від старту −2,6 кг», whatever the period. */
export const WeightStartRow = ({ start, fromStart, today }: WeightStartRowProps) => {
	const { t } = useTranslation()
	const dateLabel =
		start.localDate === today
			? t('measurement.chart.today')
			: formatDayMonthShort(toCalendarDate(start.localDate))

	return (
		<div className="flex items-center justify-between gap-3 border-t border-divider pt-2.5">
			<Text as="span" variant="caption" weight="regular" tone="muted">
				{t('progress.weight.start')}{' '}
				<Text as="span" variant="caption" weight="extrabold" tone="ink">
					{formatMeasurement(start.value, 'WEIGHT', t)}
				</Text>{' '}
				· {dateLabel}
			</Text>
			{fromStart !== null && (
				<Text as="span" variant="caption" weight="regular" tone="muted">
					{t('progress.weight.fromStart')}{' '}
					<Text as="span" variant="caption" weight="extrabold" tone="successInk">
						{formatMeasurementDelta(fromStart, 'WEIGHT', t)}
					</Text>
				</Text>
			)}
		</div>
	)
}
