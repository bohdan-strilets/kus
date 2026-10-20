import {
	type EarlierEntryContext,
	EARLIER_NAMED_MAX_ENTRIES,
	EARLIER_YESTERDAY_MAX_ENTRIES,
	isFoodMentioned,
	normalizeName,
} from '@kus/shared'

import { formatDbDate } from '../../common/time'
import type { EntryWithMealType } from '../entries/entries.repository'

const YESTERDAY_REF_PREFIX = 'y'
const HISTORY_REF_PREFIX = 'h'

/** Ref → id of the entries the model saw in this request; a copyRef can point at nothing else. */
export type CopyRefIds = ReadonlyMap<string, string>

export interface EarlierContext {
	earlier: EarlierEntryContext[]
	copyRefIds: CopyRefIds
}

export const NO_EARLIER_CONTEXT: EarlierContext = { earlier: [], copyRefIds: new Map() }

const round = (value: number): number => Math.round(value)

/** The same dish of the same size twice adds nothing for the model to choose from. */
const getEntryKey = ({ name, grams, kcal }: EntryWithMealType): string =>
	`${normalizeName(name)}|${round(grams)}|${round(kcal)}`

const toEarlier = (entry: EntryWithMealType, ref: string): EarlierEntryContext => ({
	ref,
	date: formatDbDate(entry.meal.localDate),
	mealType: entry.meal.type,
	name: entry.name,
	grams: entry.grams,
	kcal: entry.kcal,
})

/**
 * Numbers yesterday's entries `y1…` (oldest first) and the newest older entries whose food the
 * message names `h1…`. Entries are the user's own, active ones — the caller filtered by userId.
 */
export const buildEarlierContext = ({
	text,
	yesterday,
	recent,
}: {
	text: string
	yesterday: EntryWithMealType[]
	/** Newest first. */
	recent: EntryWithMealType[]
}): EarlierContext => {
	const yesterdayEntries = yesterday.slice(0, EARLIER_YESTERDAY_MAX_ENTRIES)
	const shown = new Set(yesterdayEntries.map((entry) => entry.id))
	const seen = new Set<string>()
	const named: EntryWithMealType[] = []
	for (const entry of recent) {
		if (named.length >= EARLIER_NAMED_MAX_ENTRIES) break
		if (
			shown.has(entry.id) ||
			!isFoodMentioned({ nameNormalized: normalizeName(entry.name), aliases: [] }, text)
		) {
			continue
		}
		const key = getEntryKey(entry)
		if (seen.has(key)) continue
		seen.add(key)
		named.push(entry)
	}
	const numbered = [
		...yesterdayEntries.map((entry, index) => ({
			entry,
			ref: `${YESTERDAY_REF_PREFIX}${index + 1}`,
		})),
		...named.map((entry, index) => ({ entry, ref: `${HISTORY_REF_PREFIX}${index + 1}` })),
	]
	return {
		earlier: numbered.map(({ entry, ref }) => toEarlier(entry, ref)),
		copyRefIds: new Map(numbered.map(({ entry, ref }) => [ref, entry.id])),
	}
}
