import { describe, expect, it } from 'vitest'

import { formatContext, type FoodParseContext } from './context.js'
import {
	COPY_REF_PATTERN,
	type EarlierEntryContext,
	formatEarlierEntries,
	hasHistoryReference,
} from './history-context.js'

describe('hasHistoryReference', () => {
	it.each([
		'Вчора на обід була гречка',
		'те саме, що й учора',
		'Як вчора',
		'з’їв те саме',
		"з'їв ту саму піцу",
		'ті самі яйця',
		'того самого супу',
		'тих самих млинців',
		'такий самий сніданок',
		'така сама порція',
		'такі самі тости',
		'як завжди',
		'знову каша',
		'ще раз кава',
		'те, що вже був минулого тижня',
		'пам’ятаєш, що я їв?',
		"Пам'ятаєш мій омлет",
		'як минулого разу',
		'останній раз я їв рис',
		'останнього разу було менше',
		'ВЧОРАШНІЙ борщ',
	])('finds a pointer back in "%s"', (text) => {
		expect(hasHistoryReference(text)).toBe(true)
	})

	it.each(['200 г гречки і курка', 'випив каву', 'сам приготував суп', 'та каша з молоком', ''])(
		'does not fire on "%s"',
		(text) => {
			expect(hasHistoryReference(text)).toBe(false)
		},
	)
})

describe('COPY_REF_PATTERN', () => {
	it('takes y and h refs only', () => {
		expect(['y1', 'h5', 'y15'].every((ref) => COPY_REF_PATTERN.test(ref))).toBe(true)
		expect(['m1', 'e1', 'y', 'h', 'y1000', 'y1a'].some((ref) => COPY_REF_PATTERN.test(ref))).toBe(
			false,
		)
	})
})

const earlier: EarlierEntryContext[] = [
	{
		ref: 'y1',
		date: '2026-10-18',
		mealType: 'LUNCH',
		name: 'Гречка варена',
		grams: 200.4,
		kcal: 246.6,
	},
	{ ref: 'h1', date: '2026-10-10', mealType: 'DINNER', name: 'Омлет', grams: 150, kcal: 260 },
]

const context: FoodParseContext = {
	localTime: '2026-10-19 13:20, Monday',
	dayTotals: { kcal: 0, protein: 0, fat: 0, carbs: 0 },
	meals: [],
	entries: [],
	deletedEntries: [],
	openClarifications: [],
	goal: null,
	measurements: { today: '2026-10-19', weights: [], waist: null, targetWeightKg: null },
	memory: [],
	history: [],
}

describe('formatEarlierEntries', () => {
	it('lists the entries under one heading with refs, day, meal, grams and kcal', () => {
		expect(formatEarlierEntries(earlier)).toEqual([
			'Earlier entries (copyRef — only when the user means the same food as before):',
			'- y1 2026-10-18 LUNCH "Гречка варена": 200 g, 247 kcal',
			'- h1 2026-10-10 DINNER "Омлет": 150 g, 260 kcal',
		])
	})

	it('has no section at all without entries', () => {
		expect(formatEarlierEntries([])).toEqual([])
	})
})

describe('formatContext earlier entries', () => {
	it('adds the section after the saved foods', () => {
		const text = formatContext({ ...context, earlier })
		expect(text).toContain('Earlier entries')
		expect(text.indexOf('Saved foods')).toBeLessThan(text.indexOf('Earlier entries'))
	})

	it('is unchanged when there are none, omitted or empty', () => {
		expect(formatContext({ ...context, earlier: [] })).toBe(formatContext(context))
		expect(formatContext(context)).not.toContain('Earlier entries')
	})
})
