import { describe, expect, it } from 'vitest'

import { formatContext, type FoodParseContext } from './context.js'
import type { TodayEntryContext } from './edit-context.js'

const entry: TodayEntryContext = {
	ref: 'e1',
	name: 'Борщ',
	mealType: 'LUNCH',
	grams: 300,
	kcal: 225,
	protein: 8,
	fat: 4,
	carbs: 15,
	fiber: null,
	category: 'soup',
	source: 'ESTIMATE',
	isEdited: true,
}

const makeContext = (overrides: Partial<FoodParseContext> = {}): FoodParseContext => ({
	localTime: '2026-10-27 18:30, Tuesday',
	dayTotals: { kcal: 225, protein: 8, fat: 4, carbs: 15 },
	meals: [],
	entries: [entry],
	deletedEntries: [],
	openClarifications: [],
	goal: null,
	measurements: { today: '2026-10-27', weights: [], waist: null, targetWeightKg: null },
	memory: [],
	history: [],
	...overrides,
})

describe('formatContext address form', () => {
	it.each([
		['MASCULINE', 'Address form: masculine.'],
		['FEMININE', 'Address form: feminine.'],
	] as const)('tells the model the %s form right after the time', (addressForm, line) => {
		const lines = formatContext(makeContext({ addressForm })).split('\n')

		expect(lines[0]).toBe('Local time: 2026-10-27 18:30, Tuesday.')
		expect(lines[1]).toBe(line)
	})

	it('says neutral too, and adds nothing only when the form is not set', () => {
		expect(formatContext(makeContext({ addressForm: 'NEUTRAL' }))).toContain(
			'Address form: neutral.',
		)
		expect(formatContext(makeContext())).not.toContain('Address form')
	})
})

describe('formatContext values before the change', () => {
	it('lists what an edited entry held when it was logged', () => {
		const text = formatContext(
			makeContext({ entries: [{ ...entry, was: { grams: 200, kcal: 150, protein: 5, fat: 3 } }] }),
		)

		expect(text).toContain('(changed after logging; was: 200 g, 150 kcal, P 5 F 3)')
	})

	it('adds «originally» to a field changed more than once', () => {
		const text = formatContext(
			makeContext({
				entries: [
					{
						...entry,
						was: { grams: 100, kcal: 150, originally: { grams: 80, protein: 4 } },
					},
				],
			}),
		)

		expect(text).toContain('(changed after logging; was: 100 g (originally 80 g), 150 kcal)')
	})

	it('shows a renamed entry and a moved meal', () => {
		const text = formatContext(
			makeContext({ entries: [{ ...entry, was: { name: 'Суп', mealType: 'DINNER' } }] }),
		)

		expect(text).toContain('(changed after logging; was: "Суп", DINNER)')
	})

	it('keeps the plain marker when nothing about the original is known', () => {
		const text = formatContext(makeContext())

		expect(text).toContain('C 15 (changed after logging)')
		expect(text).not.toContain('was:')
	})

	it('shows nothing about an entry that was never changed', () => {
		const text = formatContext(
			makeContext({ entries: [{ ...entry, isEdited: false, was: { grams: 1 } }] }),
		)

		expect(text).not.toContain('changed after logging')
	})
})
