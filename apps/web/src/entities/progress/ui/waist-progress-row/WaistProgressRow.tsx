import type { ProgressWaist } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { formatMeasurement, formatMeasurementDelta } from '@/entities/measurement'
import { Surface, Text } from '@/shared/ui'

export interface WaistProgressRowProps {
	waist: ProgressWaist
}

/**
 * A compact row under the weight: the latest waist and its change over the same period. The
 * mockups have no waist, so it is built from the same parts as the weight card.
 */
export const WaistProgressRow = ({ waist }: WaistProgressRowProps) => {
	const { t } = useTranslation()
	const { current, changeInRange, points } = waist
	const hasPoints = points.length > 0

	return (
		<Surface
			variant="list"
			radius="panel"
			className="flex items-center justify-between gap-3 px-4 py-3"
		>
			<div className="flex min-w-0 flex-col">
				<Text as="span" variant="caption" tone="muted">
					{t('progress.waist.label')}
				</Text>
				{!hasPoints && (
					<Text as="span" variant="small" weight="regular" tone="muted">
						{t('progress.noMeasurements')}
					</Text>
				)}
			</div>
			<div className="flex items-center gap-2">
				{hasPoints && points.length > 1 && changeInRange !== null && (
					<span className="rounded-badge bg-success-soft px-2.5 py-1 text-caption font-extrabold text-success-ink tabular-nums">
						{formatMeasurementDelta(changeInRange, 'WAIST', t)}
					</span>
				)}
				<Text as="span" variant="stat">
					{formatMeasurement(current.value, 'WAIST', t)}
				</Text>
			</div>
		</Surface>
	)
}
