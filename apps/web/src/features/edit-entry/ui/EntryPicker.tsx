import type { LoggedMeal } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { EntryItem, toFoodEntryView } from '@/entities/entry'

interface EntryPickerProps {
	meal: LoggedMeal
	onPick: (entryId: string) => void
}

/** A chat card with several lines: which one to edit — then the form for it. */
export const EntryPicker = ({ meal, onPick }: EntryPickerProps) => {
	const { t } = useTranslation()

	return (
		<div className="flex flex-col gap-0.5">
			{meal.entries.map((entry) => (
				<EntryItem
					key={entry.id}
					entry={toFoodEntryView(entry, { isClarifying: false, answer: null }, t)}
					onEdit={() => {
						onPick(entry.id)
					}}
				/>
			))}
		</div>
	)
}
