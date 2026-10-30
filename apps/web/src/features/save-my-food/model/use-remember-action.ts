import type { FoodEntryResponse } from '@kus/shared'
import { useState } from 'react'

import { getRememberableEntries } from '../lib/get-rememberable-entries'
import { useRememberEntries } from './use-remember-entries'

export interface RememberActionState {
	/** The new lines of the card. */
	rememberable: FoodEntryResponse[]
	/** Names saved from this card; they outlive the button (the refetch drops `canRemember`). */
	rememberedNames: readonly string[]
	isSheetOpen: boolean
	isPending: boolean
	/** False when there is neither a button nor a result line to show. */
	isVisible: boolean
	setIsSheetOpen: (isOpen: boolean) => void
	/** One new line is saved at once, several open the sheet. */
	press: () => void
	submit: (entryIds: readonly string[]) => Promise<void>
}

/** State of «Запам'ятати» on a meal card. Lives in the card, so the result line survives the refetch. */
export const useRememberAction = (entries: readonly FoodEntryResponse[]): RememberActionState => {
	const { remember, isPending } = useRememberEntries()
	const [rememberedNames, setRememberedNames] = useState<readonly string[]>([])
	const [rememberedIds, setRememberedIds] = useState<readonly string[]>([])
	const [isSheetOpen, setIsSheetOpen] = useState(false)
	// the lines saved here leave the list at once, not with the refetch: the status and the missing
	// button come in one render, and the refetch then changes nothing in the card's height
	const rememberable = getRememberableEntries(entries).filter(
		(entry) => !rememberedIds.includes(entry.id),
	)

	const submit = async (entryIds: readonly string[]): Promise<void> => {
		await remember(entryIds, () => {
			setIsSheetOpen(false)
			setRememberedIds((previous) => [...previous, ...entryIds])
			// a second save in the same card adds to the line instead of replacing it
			const saved = entries
				.filter((entry) => entryIds.includes(entry.id))
				.map((entry) => entry.name)
			setRememberedNames((previous) => [...previous, ...saved])
		})
	}

	const press = (): void => {
		const [only] = rememberable
		if (rememberable.length === 1 && only) void submit([only.id])
		else setIsSheetOpen(true)
	}

	return {
		rememberable,
		rememberedNames,
		isSheetOpen,
		isPending,
		isVisible: rememberable.length > 0 || rememberedNames.length > 0,
		setIsSheetOpen,
		press,
		submit,
	}
}
