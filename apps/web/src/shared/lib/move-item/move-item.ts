const isInRange = (list: readonly unknown[], index: number): boolean =>
	Number.isInteger(index) && index >= 0 && index < list.length

/** The item taken from `from` and put at `to`; the same order (a copy) when either index is off the list. */
export const moveItem = <T>(list: readonly T[], from: number, to: number): T[] => {
	if (!isInRange(list, from) || !isInRange(list, to) || from === to) return [...list]
	const next = [...list]
	const [moved] = next.splice(from, 1)
	if (moved !== undefined) next.splice(to, 0, moved)
	return next
}

/** One step up (-1) or down (1); the same order (a copy) when the item is already at that end. */
export const moveItemBy = <T>(list: readonly T[], index: number, delta: -1 | 1): T[] =>
	moveItem(list, index, index + delta)

/** The list in the order of `keys` (a drag gives the whole new order); a mismatch keeps the list. */
export const orderByKeys = <T>(
	list: readonly T[],
	keys: readonly string[],
	getKey: (item: T) => string,
): T[] => {
	const byKey = new Map(list.map((item) => [getKey(item), item]))
	const ordered = keys.flatMap((key) => byKey.get(key) ?? [])
	return ordered.length === list.length ? ordered : [...list]
}
