// Fuzzy search of foods (saved MyFood and past entries) by a free-form query. Tuned for recall:
// the model gets candidates and decides itself. It is tolerant to Latin/Cyrillic spelling of the
// same word ("Sportyfeel" ↔ "Спортіфіл"), prefixes ("прот" → "протеїновий") and Polish diacritics.
// Pure functions, shared by the backend and the eval.

import { normalizeFoodName } from './normalize-food-name.js'

export const FOOD_SEARCH_MIN_WORD_LENGTH = 3
export const FOOD_SEARCH_MIN_SCORE = 0.34
export const FOOD_SEARCH_LIMIT = 8
const MIN_TRIGRAM_SIMILARITY = 0.5
const TRIGRAM_SIZE = 3
const MAX_USAGE_FOR_BONUS = 20
const USAGE_BONUS = 0.05
const RECENCY_BONUS = 0.01
const RECENCY_DAYS = 30
const MS_PER_DAY = 86_400_000

export type FoodSearchSource = 'saved' | 'history'

export type FoodSearchCandidate = {
	/** Reference the model uses later (`m…` for saved, `h…` for history). */
	ref: string
	source: FoodSearchSource
	name: string
	aliases?: readonly string[]
	usageCount?: number
	lastUsedAt?: Date | string | number | null
}

export type FoodSearchResult = {
	candidate: FoodSearchCandidate
	score: number
}

export type FoodSearchOptions = {
	limit?: number
	minScore?: number
	now?: Date | number
}

const CHAR_REPLACEMENTS: Readonly<Record<string, string>> = {
	ł: 'l',
	ї: 'і',
	є: 'е',
	ґ: 'г',
	ё: 'е',
	ы: 'и',
	э: 'е',
	ъ: '',
}

const CYRILLIC_TO_LATIN: Readonly<Record<string, string>> = {
	а: 'a',
	б: 'b',
	в: 'v',
	г: 'g',
	д: 'd',
	е: 'e',
	ж: 'zh',
	з: 'z',
	и: 'i',
	і: 'i',
	й: 'i',
	к: 'k',
	л: 'l',
	м: 'm',
	н: 'n',
	о: 'o',
	п: 'p',
	р: 'r',
	с: 's',
	т: 't',
	у: 'u',
	ф: 'f',
	х: 'h',
	ц: 'ts',
	ч: 'ch',
	ш: 'sh',
	щ: 'sh',
	ь: '',
	ю: 'iu',
	я: 'ia',
}

const PHONETIC_FOLDS: ReadonlyArray<readonly [RegExp, string]> = [
	[/ee/g, 'i'],
	[/ph/g, 'f'],
	[/ck/g, 'k'],
	[/y/g, 'i'],
	[/w/g, 'v'],
]

const APOSTROPHE_PATTERN = /['’ʼ`´]/g
const DIACRITICS_PATTERN = /\p{M}/gu
const WORD_SPLIT_PATTERN = /[^\p{L}\p{N}]+/u
const REPEATED_LETTER_PATTERN = /(\p{L})\1+/gu

const toNormalizedWords = (text: string): string[] => {
	const lowered = normalizeFoodName(text).toLowerCase().replace(APOSTROPHE_PATTERN, '')
	const replaced = Array.from(lowered, (char) => CHAR_REPLACEMENTS[char] ?? char).join('')
	return replaced
		.normalize('NFKD')
		.replace(DIACRITICS_PATTERN, '')
		.split(WORD_SPLIT_PATTERN)
		.filter((word) => word.length > 0)
}

/** Spelling-independent form of a normalized word: Cyrillic transliterated, phonetics folded. */
export const toFoodSkeleton = (word: string): string => {
	const latin = Array.from(word, (char) => CYRILLIC_TO_LATIN[char] ?? char).join('')
	const folded = PHONETIC_FOLDS.reduce((acc, [pattern, to]) => acc.replace(pattern, to), latin)
	return folded.replace(REPEATED_LETTER_PATTERN, '$1')
}

const toTrigrams = (skeleton: string): Set<string> => {
	const result = new Set<string>()
	for (let i = 0; i + TRIGRAM_SIZE <= skeleton.length; i += 1) {
		result.add(skeleton.slice(i, i + TRIGRAM_SIZE))
	}
	return result
}

const getJaccard = (a: string, b: string): number => {
	const first = toTrigrams(a)
	const second = toTrigrams(b)
	if (first.size === 0 || second.size === 0) return 0
	let shared = 0
	first.forEach((gram) => {
		if (second.has(gram)) shared += 1
	})
	return shared / (first.size + second.size - shared)
}

const getWordSimilarity = (queryWord: string, nameWord: string): number => {
	const isPrefix = queryWord.startsWith(nameWord) || nameWord.startsWith(queryWord)
	if (isPrefix) return 1
	const jaccard = getJaccard(queryWord, nameWord)
	return jaccard >= MIN_TRIGRAM_SIMILARITY ? jaccard : 0
}

const toSkeletons = (text: string, minLength: number): string[] =>
	toNormalizedWords(text)
		.filter((word) => word.length >= minLength)
		.map(toFoodSkeleton)
		.filter((skeleton) => skeleton.length >= minLength)

/** Mean over query words of the best match among the words of the name and its aliases. */
const getCoverage = (queryWords: string[], candidate: FoodSearchCandidate): number => {
	const nameWords = [candidate.name, ...(candidate.aliases ?? [])].flatMap((text) =>
		toSkeletons(text, 1),
	)
	if (nameWords.length === 0) return 0
	const total = queryWords.reduce(
		(sum, queryWord) =>
			sum + Math.max(...nameWords.map((nameWord) => getWordSimilarity(queryWord, nameWord))),
		0,
	)
	return total / queryWords.length
}

const toTimestamp = (value: FoodSearchCandidate['lastUsedAt']): number | null => {
	if (value === null || value === undefined) return null
	const time = value instanceof Date ? value.getTime() : new Date(value).getTime()
	return Number.isNaN(time) ? null : time
}

const getBonus = (candidate: FoodSearchCandidate, now: number): number => {
	const usage = Math.min(Math.max(candidate.usageCount ?? 0, 0), MAX_USAGE_FOR_BONUS)
	const usageBonus = (usage / MAX_USAGE_FOR_BONUS) * USAGE_BONUS
	const lastUsed = toTimestamp(candidate.lastUsedAt)
	if (lastUsed === null) return usageBonus
	const ageDays = Math.max(0, (now - lastUsed) / MS_PER_DAY)
	const freshness = Math.max(0, 1 - ageDays / RECENCY_DAYS)
	return usageBonus + freshness * RECENCY_BONUS
}

/**
 * Candidates whose name or aliases cover the words of the query (words ≥ 3 characters). The
 * threshold applies to the coverage; usage and freshness only reorder equally good matches.
 */
export const searchFoods = (
	query: string,
	candidates: readonly FoodSearchCandidate[],
	options: FoodSearchOptions = {},
): FoodSearchResult[] => {
	const { limit = FOOD_SEARCH_LIMIT, minScore = FOOD_SEARCH_MIN_SCORE } = options
	const now = options.now === undefined ? Date.now() : new Date(options.now).getTime()
	const queryWords = toSkeletons(query, FOOD_SEARCH_MIN_WORD_LENGTH)
	if (queryWords.length === 0) return []
	return candidates
		.map((candidate) => ({ candidate, coverage: getCoverage(queryWords, candidate) }))
		.filter(({ coverage }) => coverage >= minScore)
		.map(({ candidate, coverage }) => ({
			candidate,
			score: coverage + getBonus(candidate, now),
		}))
		.sort((a, b) => b.score - a.score)
		.slice(0, limit)
}
