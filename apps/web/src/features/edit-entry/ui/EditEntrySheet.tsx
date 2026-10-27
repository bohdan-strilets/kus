import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getMealLabelKey } from '@/entities/entry'
import { useSessionUser } from '@/entities/session'
import {
	formatDayHeading,
	formatTime,
	getLocalDateString,
	toCalendarDate,
	useLocalDate,
} from '@/shared/lib'
import { BaseBottomSheet } from '@/shared/ui'

import { type EditEntryTarget, useEditEntryStore } from '../model/edit-entry-store'
import { EditEntryForm } from './EditEntryForm'
import { EntryPicker } from './EntryPicker'

const DEFAULT_TIME_ZONE = 'UTC'

/** Today's entry shows its time; an older one its day, since the time alone would not say which. */
const getWhenLabel = (eatenAt: string, timeZone: string, today: string): string => {
	const eaten = new Date(eatenAt)
	const localDate = getLocalDateString(eaten, timeZone)
	return localDate === today ? formatTime(eaten) : formatDayHeading(toCalendarDate(localDate))
}

/**
 * docs Sheet «Редагування запису», rendered once per page and opened through useEditEntryStore:
 * from a food line on «Сьогодні» (the form at once) or a chat card's «Редагувати» (the picker
 * first when the card has several lines).
 */
export const EditEntrySheet = () => {
	const { t } = useTranslation()
	const target = useEditEntryStore((state) => state.target)
	const selectEntry = useEditEntryStore((state) => state.selectEntry)
	const close = useEditEntryStore((state) => state.close)
	const settle = useEditEntryStore((state) => state.settle)
	// the sheet slides out with its content, so the last target stays until it is gone
	const [shown, setShown] = useState<EditEntryTarget | null>(target)
	if (target !== null && target !== shown) setShown(target)

	const entry = shown?.entryId
		? (shown.meal.entries.find((item) => item.id === shown.entryId) ?? null)
		: null
	const mealLabel = shown ? t(getMealLabelKey(shown.meal.type)) : ''
	const timeZone = useSessionUser()?.timezone ?? DEFAULT_TIME_ZONE
	const today = useLocalDate(timeZone)
	const when = shown ? getWhenLabel(shown.meal.eatenAt, timeZone, today) : ''

	return (
		<BaseBottomSheet
			isOpen={target !== null}
			onOpenChange={(isOpen) => {
				if (!isOpen) close()
			}}
			title={entry ? entry.name : mealLabel}
			description={
				entry ? t('editEntry.subtitle', { meal: mealLabel, when }) : t('editEntry.pick', { when })
			}
		>
			{shown &&
				(entry ? (
					<EditEntryForm key={entry.id} entry={entry} meal={shown.meal} onSettled={settle} />
				) : (
					<EntryPicker meal={shown.meal} onPick={selectEntry} />
				))}
		</BaseBottomSheet>
	)
}
