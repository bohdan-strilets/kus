import type { MeasurementCard } from '@kus/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatDayHeading, formatTime, toCalendarDate } from '@/shared/lib'
import { BaseBottomSheet } from '@/shared/ui'

import { useEditMeasurementStore } from '../model/edit-measurement-store'
import { useMeasurementActions } from '../model/use-measurement-actions'
import { EditMeasurementForm } from './EditMeasurementForm'

/**
 * mockups/measurement-edit.html, rendered once per page and opened through useEditMeasurementStore
 * from a chat card's «Редагувати». Weight and waist share it.
 */
export const EditMeasurementSheet = () => {
	const { t } = useTranslation()
	const target = useEditMeasurementStore((state) => state.target)
	const close = useEditMeasurementStore((state) => state.close)
	const actions = useMeasurementActions({ onGone: close })
	// the sheet slides out with its content, so the last target stays until it is gone
	const [shown, setShown] = useState<MeasurementCard | null>(target)
	if (target !== null && target !== shown) setShown(target)

	// «Неділя, 18 жовтня · 08:10»; a value written for an earlier day has no time to show
	const getSubtitle = (card: MeasurementCard): string => {
		const date = formatDayHeading(toCalendarDate(card.localDate))
		if (card.measuredAt === null) return date
		return t('editMeasurement.subtitle', { date, time: formatTime(new Date(card.measuredAt)) })
	}

	return (
		<BaseBottomSheet
			isOpen={target !== null}
			onOpenChange={(isOpen) => {
				if (!isOpen) close()
			}}
			title={shown ? t(`editMeasurement.title.${shown.kind}`) : ''}
			description={shown ? getSubtitle(shown) : undefined}
			initialFocus="first-field"
		>
			{shown && (
				<EditMeasurementForm key={shown.id} card={shown} actions={actions} onDone={close} />
			)}
		</BaseBottomSheet>
	)
}
