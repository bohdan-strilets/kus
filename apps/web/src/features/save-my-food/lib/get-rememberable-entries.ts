import type { FoodEntryResponse } from '@kus/shared'

/** The lines of a card that are not in «Мої продукти» yet; an old API has no flag, so no lines. */
export const getRememberableEntries = (
	entries: readonly FoodEntryResponse[],
): FoodEntryResponse[] => entries.filter((entry) => entry.canRemember)

/** «Що запам'ятати?» opens with every new line checked. */
export const getInitialSelection = (entries: readonly FoodEntryResponse[]): ReadonlySet<string> =>
	new Set(getRememberableEntries(entries).map((entry) => entry.id))

/** Order of the card, not of the taps: the request reads the same however the boxes were ticked. */
export const getSelectedIds = (
	entries: readonly FoodEntryResponse[],
	selection: ReadonlySet<string>,
): string[] => entries.filter((entry) => selection.has(entry.id)).map((entry) => entry.id)
