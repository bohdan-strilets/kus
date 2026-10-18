import type { MeasurementCard } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { formatShortDate, toCalendarDate } from '@/shared/lib'
import { Surface, Text } from '@/shared/ui'

import { formatMeasurement } from '../../lib/format-measurement'

export interface DeletedMeasurementRowProps {
	card: MeasurementCard
	/** Next to Kusik's head; under his words it is an attachment without the tail. */
	hasTail?: boolean
}

/** mockups/measurement-edit.html: a deleted measurement shrinks from its card to one quiet line. */
export const DeletedMeasurementRow = ({ card, hasTail = true }: DeletedMeasurementRowProps) => {
	const { t } = useTranslation()

	return (
		<Surface
			radius={hasTail ? 'bubbleAi' : 'card'}
			shadow="none"
			className="bg-surface/55 px-3.5 py-2.5"
		>
			<Text variant="small" weight="regular" tone="muted">
				{t('measurement.deleted', {
					value: formatMeasurement(card.value, card.kind, t),
					date: formatShortDate(toCalendarDate(card.localDate)),
				})}
			</Text>
		</Surface>
	)
}
