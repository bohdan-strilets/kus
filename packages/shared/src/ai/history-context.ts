// «Earlier entries»: yesterday's and older entries the user may mean by «як вчора» / «те саме».
// Shown to the model only when the message points back, so a normal turn pays no tokens for it.
import type { MealType } from '../schemas/enums.js'

/** Yesterday's entries listed as `y1…`. */
export const EARLIER_YESTERDAY_MAX_ENTRIES = 15
/** Older entries whose name the message mentions, listed as `h1…`, newest first. */
export const EARLIER_NAMED_MAX_ENTRIES = 5
/** How far back a named entry is looked up, days before today. */
export const EARLIER_NAMED_LOOKBACK_DAYS = 30

/** `y1…` (yesterday) or `h1…` (history) — never a database id. */
export const COPY_REF_PATTERN = /^[yh]\d{1,3}$/

export interface EarlierEntryContext {
	ref: string
	/** `YYYY-MM-DD` */
	date: string
	mealType: MealType
	name: string
	grams: number
	kcal: number
}

const APOSTROPHES = /[’ʼ`´]/g

// \p{L} instead of \b: word boundaries do not know Cyrillic
const word = (pattern: string): RegExp =>
	new RegExp(String.raw`(?<!\p{L})(?:${pattern})(?!\p{L})`, 'u')

const SAME_ENDINGS = 'ий|у|а|е|і|ого|ої|ому|ій|им|ою|их'
const DEMONSTRATIVE = 'т(?:ой|у|а|е|і|ого|ої|ієї|ому|ій|им|ою|ією|их)'
const SUCH = 'так(?:ий|у|а|е|і|ого|ої|ому|ій|им|ою|их)'

const HISTORY_MARKERS: readonly RegExp[] = [
	word(String.raw`вчора|учора|вчорашн\p{L}*`),
	word(String.raw`(?:${DEMONSTRATIVE}|${SUCH})\s+сам(?:${SAME_ENDINGS})`),
	word(String.raw`як\s+завжди`),
	word('знову'),
	word(String.raw`ще\s+раз`),
	word(String.raw`що\s+вже\s+був\p{L}*`),
	word(String.raw`пам'?ята\p{L}*`),
	word(String.raw`останн(?:ій|ього)\s+раз(?:у)?`),
	word(String.raw`минулого\s+разу`),
]

/** The message points at something eaten before; cheap, regex only. */
export const hasHistoryReference = (text: string): boolean => {
	const normalized = text.toLowerCase().replace(APOSTROPHES, "'").replace(/\s+/g, ' ')
	return HISTORY_MARKERS.some((marker) => marker.test(normalized))
}

const round = (value: number): number => Math.round(value)

const formatEarlierEntry = (entry: EarlierEntryContext): string =>
	`- ${entry.ref} ${entry.date} ${entry.mealType} "${entry.name}": ${round(entry.grams)} g, ${round(entry.kcal)} kcal`

/** No entries — no section at all. */
export const formatEarlierEntries = (entries: readonly EarlierEntryContext[]): string[] =>
	entries.length === 0
		? []
		: [
				'Earlier entries (copyRef — only when the user means the same food as before):',
				...entries.map(formatEarlierEntry),
			]
