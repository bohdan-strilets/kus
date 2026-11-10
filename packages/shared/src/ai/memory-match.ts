// Cheap fuzzy match of saved foods (MyFood) against a chat message, tolerant to Ukrainian endings
// ("гречка" ↔ "гречки"). Shared by the backend and the eval; runs in memory (docs/database.md).

import { MEMORY_PASSIVE_MAX_FOODS } from './context.js'
import { type FoodSearchCandidate, searchFoods } from './food-search.js'

/** Same normalization as MyFood.nameNormalized: lowercase, trimmed, single spaces. */
export const normalizeName = (name: string): string =>
	name.trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * Minimum coverage of the message's food words for the passive "Saved foods" block. Higher than
 * find_food's (0.34): the block rides along with every request, so a food has to be named almost
 * entirely. Prefix and spelling variants of a word score 0.67–1.0, a half-covered name (0.5) is out.
 */
export const MEMORY_PASSIVE_MIN_SCORE = 0.6

const CLAUSE_SPLIT_PATTERN = /[,;+\n]|\s(?:і|й|та|и|i|oraz|and)\s/iu
const MIN_NOISE_SCORE = 0.01

export type MentionableFood = {
	name: string
	aliases?: readonly string[]
	usageCount?: number
	lastUsedAt?: Date | string | null
}

const toCandidates = (foods: readonly MentionableFood[]): FoodSearchCandidate[] =>
	foods.map((food, index) => ({
		ref: String(index),
		source: 'saved',
		name: food.name,
		aliases: food.aliases,
		usageCount: food.usageCount,
		lastUsedAt: food.lastUsedAt,
	}))

/** Words of the clause that resemble at least one food: "додай" and "400г" are noise, not food. */
const getFoodWords = (clause: string, candidates: FoodSearchCandidate[]): string[] =>
	clause
		.split(/[^\p{L}\p{N}]+/u)
		.filter(
			(word) =>
				searchFoods(word, candidates, { minScore: MIN_NOISE_SCORE, limit: candidates.length })
					.length > 0,
		)

/**
 * Foods named in the message (up to the limit), in the order given. The message is split into
 * clauses ("молоко і гречка"); in each, words that resemble no food are ignored and the rest must
 * be covered by the food's name or alias, so "Sportyfeel", "спортифил" and "прот батончик" find
 * their food and "молоко" does not pull in every food sharing a letter.
 */
export const findMentionedFoods = <T extends MentionableFood>(
	text: string,
	foods: readonly T[],
	options: { limit?: number; minScore?: number; now?: Date | number } = {},
): T[] => {
	const { limit = MEMORY_PASSIVE_MAX_FOODS, minScore = MEMORY_PASSIVE_MIN_SCORE, now } = options
	const candidates = toCandidates(foods)
	const scores = new Map<number, number>()
	for (const clause of text.split(CLAUSE_SPLIT_PATTERN)) {
		const foodWords = getFoodWords(clause, candidates)
		if (foodWords.length === 0) continue
		const found = searchFoods(foodWords.join(' '), candidates, {
			minScore,
			limit: candidates.length,
			now,
		})
		for (const { candidate, score } of found) {
			const index = Number(candidate.ref)
			scores.set(index, Math.max(scores.get(index) ?? 0, score))
		}
	}
	return [...scores]
		.sort(([, a], [, b]) => b - a)
		.slice(0, limit)
		.map(([index]) => index)
		.sort((a, b) => a - b)
		.map((index) => foods[index] as T)
}
