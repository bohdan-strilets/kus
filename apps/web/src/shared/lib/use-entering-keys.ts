import { useState } from 'react'

/**
 * Which keys of a list came after it was on screen — those rows grow in, the rows that were
 * there from the start appear without motion. A key that left the list is forgotten, so an
 * undo (the same key again) counts as new and grows back too.
 */
export const useEnteringKeys = (keys: readonly string[]): ReadonlySet<string> => {
	const [known, setKnown] = useState<ReadonlySet<string>>(() => new Set(keys))
	const current = new Set(keys)
	const kept = [...known].filter((key) => current.has(key))
	if (kept.length !== known.size) setKnown(new Set(kept))

	return new Set(keys.filter((key) => !known.has(key)))
}
