import type { MeasurementKind, ProgressWaist } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { formatMeasurementDelta } from '@/entities/measurement'
import { formatDayMonthShort, toCalendarDate } from '@/shared/lib'

interface RangeChangeProps {
	kind: MeasurementKind
	pointCount: number
	changeInRange: number | null
	changeSince: ProgressWaist['changeSince']
}

/**
 * The change badge of a weight or waist card: over the range with two or more points, from the
 * last earlier value («−3,0 см з 9 жовт») with exactly one. Nothing otherwise.
 */
export const RangeChange = ({ kind, pointCount, changeInRange, changeSince }: RangeChangeProps) => {
	const { t } = useTranslation()
	const label = (): string | null => {
		if (pointCount > 1 && changeInRange !== null) {
			return formatMeasurementDelta(changeInRange, kind, t)
		}
		if (pointCount === 1 && changeSince) {
			return t('progress.changeSince', {
				change: formatMeasurementDelta(changeSince.change, kind, t),
				date: formatDayMonthShort(toCalendarDate(changeSince.sinceDate)),
			})
		}
		return null
	}
	const text = label()
	if (text === null) return null

	return (
		<span className="rounded-badge bg-success-soft px-2.5 py-1 text-caption font-extrabold text-success-ink tabular-nums">
			{text}
		</span>
	)
}
