import { describe, expect, it } from 'vitest'

import { getParseRefs, mergeParseRefs } from './entry-edits.js'
import {
	createRefIssuer,
	FIND_FOOD_DESCRIPTION,
	FIND_FOOD_INVALID_ARGUMENTS_RESULT,
	FIND_FOOD_LIST_LIMIT,
	formatFindFoodDigest,
	type FindFoodData,
	type FindFoodHistoryEntry,
	findFoodInputSchema,
	parseFindFoodArguments,
	type FindFoodSavedFood,
	runFindFood,
} from './find-food.js'
import { getAiFunctionTools } from './tools.js'
import type { FoodParseContext } from './context.js'

const NOW = new Date('2026-11-09T12:00:00Z')

const sportyfeel: FindFoodSavedFood = {
	key: 'id-sporty',
	name: 'Батончик SportyFeel',
	aliases: ['протеїновий батончик'],
	per100g: { kcal: 376, protein: 50, fat: 8.4, carbs: 22 },
	pieceGrams: 45,
	defaultGrams: null,
	category: 'protein_bar',
	usageCount: 7,
	lastUsedAt: new Date('2026-11-07T09:00:00Z'),
}

const sportyEntry: FindFoodHistoryEntry = {
	key: 'id-entry',
	date: '2026-11-07',
	mealType: 'DINNER',
	name: 'Протеїновий батончик Sportyfeel',
	grams: 45,
	kcal: 170,
	source: 'LABEL',
	count: 3,
}

const banana: FindFoodHistoryEntry = {
	...sportyEntry,
	key: 'id-banana',
	name: 'Банан',
	count: 1,
}

const data: FindFoodData = { saved: [sportyfeel], history: [sportyEntry, banana] }

interface ExistingRefs {
	saved?: [string, string][]
	history?: [string, string][]
}

const run = (
	query: string,
	scope: 'saved' | 'history' | 'all' = 'all',
	existing: ExistingRefs = {},
) => {
	const refs = {
		saved: createRefIssuer('m', existing.saved ?? []),
		history: createRefIssuer('h', existing.history ?? []),
	}
	return runFindFood({ input: findFoodInputSchema.parse({ query, scope }), data, refs, now: NOW })
}

describe('findFoodInputSchema', () => {
	it('defaults the scope to all and trims the query', () => {
		expect(findFoodInputSchema.parse({ query: '  sportyfeel ' })).toEqual({
			query: 'sportyfeel',
			scope: 'all',
		})
	})

	it('rejects a too long query and an unknown scope', () => {
		expect(findFoodInputSchema.safeParse({ query: 'x'.repeat(61) }).success).toBe(false)
		expect(findFoodInputSchema.safeParse({ query: 'bar', scope: 'everywhere' }).success).toBe(false)
	})
})

describe('find_food without a query', () => {
	const food = (
		index: number,
		usageCount: number,
		lastUsedAt: Date | null = null,
	): FindFoodSavedFood => ({
		...sportyfeel,
		key: `id-${index}`,
		name: `Продукт ${index}`,
		aliases: [],
		usageCount,
		lastUsedAt,
	})
	const list = (saved: FindFoodSavedFood[], existing: ExistingRefs = {}) =>
		runFindFood({
			input: { scope: 'saved' },
			data: { saved, history: [sportyEntry] },
			refs: {
				saved: createRefIssuer('m', existing.saved ?? []),
				history: createRefIssuer('h', []),
			},
			now: NOW,
		})

	it('lists the most used foods first and ends with the total', () => {
		const result = list([
			food(1, 2),
			food(2, 9),
			food(3, 2, new Date('2026-11-08T09:00:00Z')),
			food(4, 2, new Date('2026-11-01T09:00:00Z')),
		])

		expect(result.text.split('\n').map((line) => line.split(' — ')[0])).toEqual([
			'm1 "Продукт 2"',
			'm2 "Продукт 3"',
			'm3 "Продукт 4"',
			'm4 "Продукт 1"',
			'4 saved in total; ask a name to narrow',
		])
		expect(result.refsPatch).toEqual({ memoryRefs: ['m1', 'm2', 'm3', 'm4'], copyRefs: [] })
		expect(result.foundCount).toBe(4)
	})

	it('shows at most 20 foods and still counts all of them', () => {
		const result = list(Array.from({ length: 25 }, (_, index) => food(index, index)))
		const lines = result.text.split('\n')

		expect(lines).toHaveLength(FIND_FOOD_LIST_LIMIT + 1)
		expect(lines[0]).toContain('"Продукт 24"')
		expect(lines.at(-1)).toBe('25 saved in total; ask a name to narrow')
		expect(result.foundCount).toBe(FIND_FOOD_LIST_LIMIT)
		expect(result.refsPatch.memoryRefs).toHaveLength(FIND_FOOD_LIST_LIMIT)
	})

	it('keeps the ref a food already has in the turn', () => {
		const result = list([food(1, 1)], { saved: [['m4', 'id-1']] })

		expect(result.text).toMatch(/^m4 "Продукт 1"/)
	})

	it('says so when nothing is saved, without history', () => {
		const result = list([])

		expect(result.text).toBe('No saved foods')
		expect(result.refsPatch).toEqual({ memoryRefs: [], copyRefs: [] })
		expect(result.foundCount).toBe(0)
	})

	it('is invalid for history and all, which search by name', () => {
		for (const scope of ['history', 'all'] as const) {
			const result = runFindFood({
				input: { scope },
				data,
				refs: { saved: createRefIssuer('m', []), history: createRefIssuer('h', []) },
			})
			expect(result.text).toBe(FIND_FOOD_INVALID_ARGUMENTS_RESULT)
			expect(result.foundCount).toBe(0)
		}
	})

	it('has a digest without the words', () => {
		expect(formatFindFoodDigest(undefined, 3)).toBe('read food (all saved): 3 found')
		expect(formatFindFoodDigest('батончик', 2)).toBe('read food "батончик": 2 found')
	})
})

describe('find_food as the model sees it', () => {
	it('is the first read tool, with a short English description', () => {
		const tool = getAiFunctionTools().find((item) => item.function.name === 'find_food')
		expect(tool?.function.name).toBe('find_food')
		expect(tool?.function.description).toBe(FIND_FOOD_DESCRIPTION)
		expect(FIND_FOOD_DESCRIPTION.length).toBeLessThan(1200)
	})
})

describe('createRefIssuer', () => {
	it('continues after the highest ref of its prefix and reuses a known key', () => {
		const issuer = createRefIssuer('h', [
			['y1', 'a'],
			['h1', 'b'],
			['h4', 'c'],
		])

		expect(issuer.issue('d')).toBe('h5')
		expect(issuer.issue('d')).toBe('h5')
		expect(issuer.issue('b')).toBe('h1')
		// the same entry as yesterday's y1 keeps that ref
		expect(issuer.issue('a')).toBe('y1')
		expect(issuer.getIssued()).toEqual([['h5', 'd']])
	})
})

describe('runFindFood', () => {
	it('finds a saved food and an earlier entry by a Cyrillic spelling and formats both', () => {
		const result = run('спортіфіл')

		expect(result.text.split('\n')).toEqual([
			'm1 "Батончик SportyFeel" (also: протеїновий батончик) — per 100 g: 376 kcal, P 50 g, F 8 g, C 22 g; 1 piece = 45 g; used 7×, last 07.11; category protein_bar',
			'h1 2026-11-07 DINNER "Протеїновий батончик Sportyfeel" 45 g 170 kcal LABEL — seen 3×',
		])
		expect(result.refsPatch).toEqual({ memoryRefs: ['m1'], copyRefs: ['h1'] })
		expect(result.foundCount).toBe(2)
	})

	it('searches one source by scope', () => {
		expect(run('sportyfeel', 'saved').text).toMatch(/^m1 /)
		expect(run('sportyfeel', 'saved').text).not.toContain('h1')
		expect(run('sportyfeel', 'history').text).toMatch(/^h1 /)
	})

	it('numbers new refs after the ones of the turn and keeps a known food under its ref', () => {
		const result = run('sportyfeel', 'all', {
			saved: [
				['m1', 'other'],
				['m2', 'id-sporty'],
			],
			history: [
				['y1', 'x'],
				['h3', 'y'],
			],
		})

		expect(result.refsPatch).toEqual({ memoryRefs: ['m2'], copyRefs: ['h4'] })
		expect(result.text).toContain('m2 "Батончик SportyFeel"')
		expect(result.text).toContain('h4 2026-11-07')
	})

	it('says so when nothing matches, without refs', () => {
		const result = run('борщ')

		expect(result.text).toBe('No match for "борщ"')
		expect(result.refsPatch).toEqual({ memoryRefs: [], copyRefs: [] })
		expect(result.foundCount).toBe(0)
	})

	it('hands out refs the parser then accepts', () => {
		const context: FoodParseContext = {
			localTime: '2026-11-09 13:20, Monday',
			dayTotals: { kcal: 0, protein: 0, fat: 0, carbs: 0 },
			meals: [],
			entries: [],
			deletedEntries: [],
			openClarifications: [],
			goal: null,
			measurements: { today: '2026-11-09', weights: [], waist: null, targetWeightKg: null },
			memory: [],
			history: [],
		}
		const { refsPatch } = run('sportyfeel')
		const refs = mergeParseRefs(getParseRefs(context), refsPatch)

		expect(refs.memoryRefs.has('m1')).toBe(true)
		expect(refs.copyRefs?.has('h1')).toBe(true)
	})
})

describe('parseFindFoodArguments', () => {
	it('reads valid arguments with the default scope', () => {
		expect(parseFindFoodArguments('{"query":"sportyfeel"}')).toEqual({
			query: 'sportyfeel',
			scope: 'all',
		})
	})

	it('returns null for broken JSON and for arguments outside the schema', () => {
		expect(parseFindFoodArguments('{"query":')).toBeNull()
		expect(parseFindFoodArguments('{"query":""}')).toBeNull()
		expect(parseFindFoodArguments('{}')).toBeNull()
		expect(parseFindFoodArguments('[]')).toBeNull()
		expect(parseFindFoodArguments('{"scope":"history"}')).toBeNull()
		expect(parseFindFoodArguments('{"query":"   ","scope":"all"}')).toBeNull()
		expect(parseFindFoodArguments('{"query":"x","scope":"everything"}')).toBeNull()
	})

	it('allows no query only with scope saved; blank and null count as no query', () => {
		expect(parseFindFoodArguments('{"scope":"saved"}')).toEqual({ scope: 'saved' })
		expect(parseFindFoodArguments('{"query":"  ","scope":"saved"}')).toEqual({ scope: 'saved' })
		expect(parseFindFoodArguments('{"query":null,"scope":"saved"}')).toEqual({ scope: 'saved' })
		expect(parseFindFoodArguments('{"query":" бар ","scope":"saved"}')).toEqual({
			query: 'бар',
			scope: 'saved',
		})
	})
})
