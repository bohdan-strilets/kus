import { describe, expect, it } from 'vitest'

import { type FoodSearchCandidate, searchFoods, toFoodSkeleton } from './food-search.js'

const NOW = new Date('2026-11-10T12:00:00Z')

const bar: FoodSearchCandidate = { ref: 'm1', source: 'saved', name: 'Батончик SportyFeel' }
const proteinBar: FoodSearchCandidate = {
	ref: 'm2',
	source: 'saved',
	name: 'Протеїновий батончик',
}
const buckwheat: FoodSearchCandidate = { ref: 'm3', source: 'saved', name: 'Гречка' }

const refs = (query: string, candidates: FoodSearchCandidate[]): string[] =>
	searchFoods(query, candidates, { now: NOW }).map((r) => r.candidate.ref)

describe('toFoodSkeleton', () => {
	it('unifies Latin and Cyrillic spellings', () => {
		const expected = toFoodSkeleton('sportyfeel')
		expect(toFoodSkeleton('спортіфіл')).toBe(expected)
		expect(toFoodSkeleton('спортифил')).toBe(expected)
	})
})

describe('searchFoods', () => {
	it.each(['Sportyfeel', 'SportyFeel', 'Спортіфіл', 'спортифил'])('finds the bar by "%s"', (q) => {
		expect(refs(q, [bar, buckwheat])).toEqual(['m1'])
	})

	it('finds by prefixes of several words', () => {
		expect(refs('прот батончик', [proteinBar, buckwheat])).toEqual(['m2'])
	})

	it('finds "протеіновий" (Cyrillic і instead of ї)', () => {
		expect(refs('протеіновий', [proteinBar, buckwheat])).toEqual(['m2'])
	})

	it('does not return unrelated foods', () => {
		expect(refs('гречка', [bar, proteinBar])).toEqual([])
	})

	it('returns nothing for an empty or too short query', () => {
		expect(refs('', [bar])).toEqual([])
		expect(refs('  ', [bar])).toEqual([])
		expect(refs('ба', [bar])).toEqual([])
	})

	it('ranks by usage when the match is equal', () => {
		const rare: FoodSearchCandidate = { ref: 'm4', source: 'saved', name: 'Йогурт', usageCount: 1 }
		const often: FoodSearchCandidate = { ref: 'm5', source: 'saved', name: 'Йогурт', usageCount: 9 }
		expect(refs('йогурт', [rare, often])).toEqual(['m5', 'm4'])
	})

	it('matches by alias', () => {
		const withAlias: FoodSearchCandidate = {
			ref: 'm6',
			source: 'saved',
			name: 'Кефір 1%',
			aliases: ['kefir'],
		}
		expect(refs('kefir', [withAlias, buckwheat])).toEqual(['m6'])
	})

	it('handles Polish diacritics and keeps history candidates', () => {
		const history: FoodSearchCandidate = { ref: 'h1', source: 'history', name: 'Żurek' }
		expect(refs('zurek', [history])).toEqual(['h1'])
	})

	it('respects the limit', () => {
		const many = Array.from({ length: 12 }, (_, i) => ({
			ref: `m${i}`,
			source: 'saved' as const,
			name: 'Йогурт',
		}))
		expect(searchFoods('йогурт', many, { now: NOW })).toHaveLength(8)
	})
})
