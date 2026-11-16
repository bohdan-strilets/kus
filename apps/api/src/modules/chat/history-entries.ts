/** Message id → ids of the entries it logged; built from the day already loaded, no extra query. */
export const groupEntryIdsBySourceMessage = (
	entries: { id: string; sourceMessageId: string | null }[],
): Map<string, string[]> => {
	const grouped = new Map<string, string[]>()
	for (const { id, sourceMessageId } of entries) {
		if (sourceMessageId === null) continue
		grouped.set(sourceMessageId, [...(grouped.get(sourceMessageId) ?? []), id])
	}
	return grouped
}

/** The entries of the day and those found by their message; an entry in both counts once. */
export const mergeSourceEntries = <T extends { id: string }>(day: T[], earlier: T[]): T[] => {
	const known = new Set(day.map(({ id }) => id))
	return [...day, ...earlier.filter(({ id }) => !known.has(id))]
}

export const getDeletedEntryIds = (entries: { id: string; isDeleted: boolean }[]): Set<string> =>
	new Set(entries.filter(({ isDeleted }) => isDeleted).map(({ id }) => id))
