import { describe, expect, it } from 'vitest'

import type { FoodParseContext } from './context.js'
import type { TodayEntryContext } from './edit-context.js'
import { getCorrectedValues, getParseRefs } from './entry-edits.js'
import { parseToolCalls, type RawToolCall } from './parse-tool-calls.js'

const borscht: TodayEntryContext = {
	ref: 'e1',
	name: 'Борщ червоний',
	mealType: 'LUNCH',
	grams: 350,
	kcal: 175,
	protein: 7,
	fat: 8,
	carbs: 19,
	fiber: null,
	category: 'borscht',
	source: 'ESTIMATE',
}

const pork: TodayEntryContext = {
	...borscht,
	ref: 'e2',
	name: 'Свинина',
	grams: 300,
	kcal: 600,
	protein: 57,
	fat: 42,
	carbs: 0,
	category: 'meat',
}

const porkOption = (label: string, kcal: number, protein: number, fat: number) => ({
	label,
	kcal,
	protein,
	fat,
	carbs: 0,
	fiber: 0,
	grams: 300,
	name: null,
})

const context: FoodParseContext = {
	localTime: '2026-10-08 13:00, Thursday',
	dayTotals: { kcal: 775, protein: 64, fat: 50, carbs: 19 },
	meals: [{ type: 'LUNCH', kcal: 775 }],
	entries: [borscht, pork],
	deletedEntries: [{ ref: 'e3', name: 'Банан', grams: 120, kcal: 107 }],
	openClarifications: [
		{
			ref: 'c1',
			question: 'Яка була свинина?',
			entryRefs: ['e2'],
			options: [
				porkOption('Пісна', 450, 66, 20),
				porkOption('Середня', 600, 57, 42),
				porkOption('Жирна', 800, 48, 68),
			],
		},
	],
	goal: null,
	memory: [],
	history: [],
}

const refs = getParseRefs(context)

const call = (name: string, input: unknown): RawToolCall => ({
	name,
	arguments: JSON.stringify(input),
})

const reply = call('reply', { text: 'Готово' })

const parseErrors = (calls: RawToolCall[]): string[] => {
	const result = parseToolCalls(calls, refs)
	return result.ok ? [] : result.errors
}

describe('getCorrectedValues', () => {
	it('rescales by the entry density when only grams change: 350 → 600 g', () => {
		const values = getCorrectedValues(borscht, { grams: 600, values: null })
		expect(values).toEqual({
			grams: 600,
			kcal: 300,
			protein: 12,
			fat: 13.7,
			carbs: 32.6,
			fiber: null,
		})
	})

	it('takes given values on the old weight', () => {
		const values = { kcal: 100, protein: 5, fat: 4, carbs: 11, fiber: null }
		expect(getCorrectedValues(borscht, { grams: null, values })).toEqual({ grams: 350, ...values })
	})
})

describe('parseToolCalls with edits', () => {
	it('returns an edit decision for correct_entry + reply', () => {
		const result = parseToolCalls(
			[call('correct_entry', { changes: [{ ref: 'e1', grams: 600 }] }), reply],
			refs,
		)
		expect(result).toMatchObject({ ok: true, decision: { kind: 'edit', text: 'Готово' } })
	})

	it('needs a reply for an edit-only turn', () => {
		expect(parseErrors([call('delete_entry', { refs: ['e1'] })])[0]).toContain('exactly one reply')
	})

	it('lets log_food speak for its edits', () => {
		const logFood = call('log_food', {
			items: [
				{
					...borscht,
					name: 'Хліб',
					grams: 30,
					kcal: 75,
					protein: 2.5,
					fat: 1,
					carbs: 14,
					confidence: 0.8,
					assumption: null,
				},
			],
			mealType: null,
			reply: 'Додав хліб і прибрав борщ',
		})
		const result = parseToolCalls([logFood, call('delete_entry', { refs: ['e1'] })], refs)
		expect(result).toMatchObject({
			ok: true,
			decision: { kind: 'log', edits: { deletions: ['e1'] } },
		})
	})

	it('rejects an entry outside the context with the "only today" hint', () => {
		const errors = parseErrors([call('delete_entry', { refs: ['e9'] }), reply])
		expect(errors[0]).toContain("only today's entries")
	})

	it('rejects corrected values that do not add up', () => {
		const change = { ref: 'e1', values: { kcal: 400, protein: 7, fat: 8, carbs: 19, fiber: null } }
		const errors = parseErrors([call('correct_entry', { changes: [change] }), reply])
		expect(errors[0]).toContain('does not match')
	})

	it('restores only an entry deleted today', () => {
		expect(parseErrors([call('restore_entry', { refs: ['e3'] }), reply])).toEqual([])
		expect(parseErrors([call('restore_entry', { refs: ['e1'] }), reply])[0]).toContain(
			'not in "Deleted today"',
		)
	})

	it('accepts an answer in words between two options', () => {
		const values = { kcal: 700, protein: 52, fat: 55, carbs: 0, fiber: 0, grams: null }
		const resolve = call('resolve_clarification', { ref: 'c1', answer: 'трішки жирна', values })
		expect(parseErrors([resolve, reply])).toEqual([])
	})

	it('rejects values outside the options and points to correct_entry', () => {
		const values = { kcal: 350, protein: 70, fat: 8, carbs: 0, fiber: 0, grams: null }
		const resolve = call('resolve_clarification', { ref: 'c1', answer: 'без жиру', values })
		expect(parseErrors([resolve, reply])[0]).toContain('correct_entry')
	})

	it('closes a question without values and corrects its entry in the same turn', () => {
		const resolve = call('resolve_clarification', { ref: 'c1', answer: 'взагалі без жиру' })
		const correct = call('correct_entry', {
			changes: [{ ref: 'e2', values: { kcal: 400, protein: 70, fat: 13, carbs: 0, fiber: 0 } }],
		})
		expect(parseErrors([resolve, correct, reply])).toEqual([])
	})

	it('rejects two edits of one entry', () => {
		const resolve = call('resolve_clarification', { ref: 'c1', answer: 'жирна', optionIndex: 2 })
		const remove = call('delete_entry', { refs: ['e2'] })
		expect(parseErrors([resolve, remove, reply])[0]).toContain('changed more than once')
	})

	it('rejects an option index the question does not have', () => {
		const resolve = call('resolve_clarification', { ref: 'c1', answer: 'інша', optionIndex: 5 })
		expect(parseErrors([resolve, reply])[0]).toContain('has no option 5')
	})

	it('never edits together with not_food', () => {
		const notFood = call('not_food', { reply: 'Камінь — не їжа' })
		expect(parseErrors([notFood, call('delete_entry', { refs: ['e1'] })])).not.toEqual([])
	})
})
