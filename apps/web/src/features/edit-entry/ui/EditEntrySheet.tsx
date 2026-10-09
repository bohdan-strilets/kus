import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getMealLabelKey } from '@/entities/entry'
import { formatTime } from '@/shared/lib'
import { BaseBottomSheet } from '@/shared/ui'

import { type EditEntryTarget, useEditEntryStore } from '../model/edit-entry-store'
import { EditEntryForm } from './EditEntryForm'
import { EntryPicker } from './EntryPicker'

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
	// the sheet slides out with its content, so the last target stays until it is gone
	const [shown, setShown] = useState<EditEntryTarget | null>(target)
	if (target !== null && target !== shown) setShown(target)

	const entry = shown?.entryId
		? (shown.meal.entries.find((item) => item.id === shown.entryId) ?? null)
		: null
	const mealLabel = shown ? t(getMealLabelKey(shown.meal.type)) : ''
	const time = shown ? formatTime(new Date(shown.meal.eatenAt)) : ''

	return (
		<BaseBottomSheet
			isOpen={target !== null}
			onOpenChange={(isOpen) => {
				if (!isOpen) close()
			}}
			title={entry ? entry.name : mealLabel}
			description={
				entry ? t('editEntry.subtitle', { meal: mealLabel, time }) : t('editEntry.pick', { time })
			}
		>
			{shown &&
				(entry ? (
					<EditEntryForm key={entry.id} entry={entry} meal={shown.meal} onDone={close} />
				) : (
					<EntryPicker meal={shown.meal} onPick={selectEntry} />
				))}
		</BaseBottomSheet>
	)
}
