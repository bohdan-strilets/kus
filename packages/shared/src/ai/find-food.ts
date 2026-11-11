// find_food: the model looks up a saved food or an earlier entry by the user's own words. Schema,
// description, ref numbering and the result text live here, so the backend and the eval answer the
// call with the same functions; only the data (the user's foods and entries) comes from outside.
import { z } from 'zod'

import type { ParseRefsPatch } from './entry-edits.js'
import { FOOD_SEARCH_LIMIT, type FoodSearchCandidate, searchFoods } from './food-search.js'
import { toContextText } from './memory-context.js'
import { joinReadDigest } from './read-digest.js'

export const FIND_FOOD_TOOL_NAME = 'find_food'
export const FIND_FOOD_QUERY_MAX_LENGTH = 60
/** How far back the entries of the search reach, days before today. */
export const FIND_FOOD_HISTORY_DAYS = 90
/** Most different names of past entries the search looks through. */
export const FIND_FOOD_HISTORY_NAMES_MAX = 400

export const SAVED_FOOD_REF_PREFIX = 'm'
export const HISTORY_FOOD_REF_PREFIX = 'h'

export const findFoodScopeSchema = z.enum(['saved', 'history', 'all'])

export type FindFoodScope = z.infer<typeof findFoodScopeSchema>

/** Most saved foods a find_food call without a query lists. */
export const FIND_FOOD_LIST_LIMIT = 20

export const findFoodInputSchema = z.object({
	// no minimum here: parseFindFoodArguments treats an empty query as a missing one, and a missing
	// query is valid only with scope saved (a rule the model's JSON schema cannot carry)
	query: z
		.string()
		.trim()
		.max(FIND_FOOD_QUERY_MAX_LENGTH)
		.optional()
		.describe(
			'Key words of the food as the user wrote them, any spelling: "sportyfeel", "прот батончик". Leave it out only with scope saved, to list the whole memory.',
		),
	scope: findFoodScopeSchema
		.default('all')
		.describe('saved: the saved foods; history: earlier entries; all: both'),
})

export type FindFoodInput = z.infer<typeof findFoodInputSchema>

/** Told to the model as a tool result: it can fix its arguments within the same turn. */
export const FIND_FOOD_INVALID_ARGUMENTS_RESULT = `error: invalid arguments — query is 1–${FIND_FOOD_QUERY_MAX_LENGTH} characters of the food name; it may be left out only with scope saved`

/** The model's raw JSON arguments; null when they are not JSON or do not fit the schema. */
export const parseFindFoodArguments = (raw: string): FindFoodInput | null => {
	try {
		const json: unknown = JSON.parse(raw)
		if (typeof json !== 'object' || json === null || Array.isArray(json)) return null
		const { query, ...rest } = json as Record<string, unknown>
		// null, an empty string and spaces all mean "no query"
		const isBlank = query === null || (typeof query === 'string' && query.trim() === '')
		const parsed = findFoodInputSchema.safeParse(isBlank ? rest : json)
		if (!parsed.success) return null
		return parsed.data.query === undefined && parsed.data.scope !== 'saved' ? null : parsed.data
	} catch {
		// not JSON: the model gets «invalid arguments» and may send them again
		return null
	}
}

export const FIND_FOOD_DESCRIPTION =
	'Look up a food the user saved or ate before that is NOT already listed in "Saved foods" or "Earlier entries": ' +
	'a brand or packaged product, "that bar", "the same as last time", or a question about what they saved. ' +
	"Query: 1–3 key words in the user's own spelling or language, without amounts. " +
	'Returns candidates: m… refs are saved foods (memoryRef, source MEMORY), h… refs are earlier entries (copyRef), with their values; or "No match". ' +
	'Candidates are guesses: use one only when it is really the food the user means, otherwise estimate or ask. ' +
	'With scope saved and no query it lists the saved foods, the most used first (at most 20), and how many there are in total: use it for "what do you remember". ' +
	'Do NOT call it for ordinary foods (banana, buckwheat, coffee) or for a food already in the context. It only reads: nothing is logged.'

export interface FindFoodSavedFood {
	/** Opaque key of the food (its database id); the model never sees it. */
	key: string
	name: string
	aliases: readonly string[]
	per100g: { kcal: number; protein: number; fat: number; carbs: number }
	pieceGrams: number | null
	defaultGrams: number | null
	category: string
	usageCount: number
	lastUsedAt: Date | null
}

export interface FindFoodHistoryEntry {
	/** Opaque key of the newest entry with this name (its database id). */
	key: string
	/** `YYYY-MM-DD` */
	date: string
	mealType: string
	name: string
	grams: number
	kcal: number
	source: string
	/** How many times this name was logged in the searched period. */
	count: number
}

/** Gives a key (an id) its ref: the one it already has in the turn, else the next free number. */
export interface RefIssuer {
	issue: (key: string) => string
	/** Refs issued by `issue`, not those that existed: what the turn's id maps still lack. */
	getIssued: () => [ref: string, key: string][]
}

/**
 * `existing` — ref → key pairs the turn already handed out (any prefix); numbering of `prefix`
 * continues after the highest of its own, so a new ref never takes an old one's place.
 */
export const createRefIssuer = (
	prefix: string,
	existing: Iterable<readonly [ref: string, key: string]>,
): RefIssuer => {
	const refByKey = new Map<string, string>()
	const ownNumber = new RegExp(`^${prefix}(\\d+)$`)
	let last = 0
	for (const [ref, key] of existing) {
		if (!refByKey.has(key)) refByKey.set(key, ref)
		last = Math.max(last, Number(ownNumber.exec(ref)?.[1] ?? 0))
	}
	const issued: [string, string][] = []
	return {
		issue: (key) => {
			const known = refByKey.get(key)
			if (known !== undefined) return known
			last += 1
			const ref = `${prefix}${last}`
			refByKey.set(key, ref)
			issued.push([ref, key])
			return ref
		},
		getIssued: () => [...issued],
	}
}

export interface FindFoodData {
	saved: readonly FindFoodSavedFood[]
	history: readonly FindFoodHistoryEntry[]
}

export interface FindFoodRefs {
	saved: RefIssuer
	history: RefIssuer
}

export interface FindFoodResult {
	/** What the model reads. */
	text: string
	refsPatch: ParseRefsPatch
	/** How many candidates were found (for metadata logs; never the names). */
	foundCount: number
}

const round = (value: number): number => Math.round(value)

const formatLastUsed = (date: Date | null): string => {
	if (date === null || Number.isNaN(date.getTime())) return ''
	// UTC day: the tool has no time zone of the user, a day off near midnight is harmless here
	const [, month, day] = date.toISOString().slice(0, 10).split('-')
	return `${day}.${month}`
}

export const formatFoundSavedFood = (food: FindFoodSavedFood, ref: string): string => {
	const aliases =
		food.aliases.length > 0 ? ` (also: ${food.aliases.map(toContextText).join(', ')})` : ''
	const { kcal, protein, fat, carbs } = food.per100g
	const piece = food.pieceGrams === null ? '' : `; 1 piece = ${food.pieceGrams} g`
	const usual = food.defaultGrams === null ? '' : `; usual portion ${food.defaultGrams} g`
	const lastUsed = formatLastUsed(food.lastUsedAt)
	const used =
		food.usageCount > 0
			? `; used ${food.usageCount}×${lastUsed === '' ? '' : `, last ${lastUsed}`}`
			: ''
	return (
		`${ref} "${toContextText(food.name)}"${aliases} — per 100 g: ${round(kcal)} kcal, ` +
		`P ${round(protein)} g, F ${round(fat)} g, C ${round(carbs)} g${piece}${usual}${used}; category ${food.category}`
	)
}

export const formatFoundHistoryEntry = (entry: FindFoodHistoryEntry, ref: string): string => {
	const seen = entry.count > 1 ? ` — seen ${entry.count}×` : ''
	return (
		`${ref} ${entry.date} ${entry.mealType} "${toContextText(entry.name)}" ` +
		`${round(entry.grams)} g ${round(entry.kcal)} kcal ${entry.source}${seen}`
	)
}

const NO_SAVED_FOODS = 'No saved foods'

export const formatNoFoodMatch = (query: string): string => `No match for "${toContextText(query)}"`

/**
 * What a find_food call found, for the history of the next turns: the words searched and how many
 * candidates, never the refs (m…/h… are only valid in the request that issued them).
 */
export const formatFindFoodDigest = (query: string | undefined, foundCount: number): string =>
	joinReadDigest(
		query === undefined
			? `read food (all saved): ${foundCount} found`
			: `read food "${toContextText(query)}": ${foundCount} found`,
		[],
	)

const searchByKey = <T extends { key: string }>(
	query: string,
	items: readonly T[],
	toCandidate: (item: T) => FoodSearchCandidate,
	now: Date,
): T[] => {
	const byKey = new Map(items.map((item) => [item.key, item]))
	return searchFoods(query, items.map(toCandidate), { limit: FOOD_SEARCH_LIMIT, now }).flatMap(
		({ candidate }) => byKey.get(candidate.ref) ?? [],
	)
}

const compareByUse = (a: FindFoodSavedFood, b: FindFoodSavedFood): number =>
	b.usageCount - a.usageCount || (b.lastUsedAt?.getTime() ?? 0) - (a.lastUsedAt?.getTime() ?? 0)

/** The whole memory without a query: the most used foods (at most FIND_FOOD_LIST_LIMIT) and the total. */
const listSavedFoods = (data: FindFoodData, refs: FindFoodRefs): FindFoodResult => {
	if (data.saved.length === 0) {
		return { text: NO_SAVED_FOODS, refsPatch: { memoryRefs: [], copyRefs: [] }, foundCount: 0 }
	}
	const shown = [...data.saved].sort(compareByUse).slice(0, FIND_FOOD_LIST_LIMIT)
	const lines = shown.map((food) => ({ ref: refs.saved.issue(food.key), food }))
	return {
		text: [
			...lines.map(({ ref, food }) => formatFoundSavedFood(food, ref)),
			`${data.saved.length} saved in total; ask a name to narrow`,
		].join('\n'),
		refsPatch: { memoryRefs: lines.map(({ ref }) => ref), copyRefs: [] },
		foundCount: lines.length,
	}
}

/**
 * The answer to one find_food call: saved foods first, then past entries (at most
 * FOOD_SEARCH_LIMIT of each), with refs issued through `refs`, and the patch of those refs.
 */
export const runFindFood = ({
	input,
	data,
	refs,
	now = new Date(),
}: {
	input: FindFoodInput
	data: FindFoodData
	refs: FindFoodRefs
	now?: Date
}): FindFoodResult => {
	const { query } = input
	if (query === undefined) {
		return input.scope === 'saved'
			? listSavedFoods(data, refs)
			: { text: FIND_FOOD_INVALID_ARGUMENTS_RESULT, refsPatch: {}, foundCount: 0 }
	}
	const saved =
		input.scope === 'history'
			? []
			: searchByKey(
					query,
					data.saved,
					(food) => ({
						ref: food.key,
						source: 'saved',
						name: food.name,
						aliases: food.aliases,
						usageCount: food.usageCount,
						lastUsedAt: food.lastUsedAt,
					}),
					now,
				)
	const history =
		input.scope === 'saved'
			? []
			: searchByKey(
					query,
					data.history,
					(entry) => ({
						ref: entry.key,
						source: 'history',
						name: entry.name,
						usageCount: entry.count,
						lastUsedAt: entry.date,
					}),
					now,
				)
	const savedLines = saved.map((food) => ({ ref: refs.saved.issue(food.key), food }))
	const historyLines = history.map((entry) => ({ ref: refs.history.issue(entry.key), entry }))
	const lines = [
		...savedLines.map(({ ref, food }) => formatFoundSavedFood(food, ref)),
		...historyLines.map(({ ref, entry }) => formatFoundHistoryEntry(entry, ref)),
	]
	return {
		text: lines.length > 0 ? lines.join('\n') : formatNoFoodMatch(query),
		refsPatch: {
			memoryRefs: savedLines.map(({ ref }) => ref),
			copyRefs: historyLines.map(({ ref }) => ref),
		},
		foundCount: lines.length,
	}
}
