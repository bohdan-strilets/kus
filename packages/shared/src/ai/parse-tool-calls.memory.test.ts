import { describe, expect, it } from 'vitest'

import type { ParseRefs } from './entry-edits.js'
import { toFoodNameKey } from './memory-errors.js'
import { parseToolCalls, type RawToolCall } from './parse-tool-calls.js'

const refs: ParseRefs = {
	memoryRefs: new Set(['m1', 'm2', 'm3']),
	memoryRefByName: new Map([[toFoodNameKey('Кабаноси'), 'm1']]),
	factRefs: new Set(['f1', 'f2']),
	pendingRemovalRefs: new Set(['m2']),
	forgottenFoodRefs: new Set(['g1', 'g2']),
	entries: new Map(),
	deletedEntryRefs: new Set(),
	clarifications: new Map(),
	today: '2026-10-30',
	measurementDays: new Set(),
}

const call = (name: string, input: unknown): RawToolCall => ({
	name,
	arguments: JSON.stringify(input),
})

const egg = {
	name: 'Яйце варене',
	grams: 150,
	quantity: 3,
	kcal: 233,
	protein: 19,
	fat: 16,
	carbs: 1.7,
	fiber: 0,
	category: 'eggs',
	source: 'REFERENCE',
	confidence: 0.9,
	assumption: null,
	memoryRef: null,
}
const logFood = call('log_food', { items: [egg], mealType: null, reply: 'Записав.' })
const reply = call('reply', { text: 'Добре.' })

const per100g = { kcal: 550, protein: 20, fat: 45, carbs: 3, fiber: null }
const fromValues = (overrides: Record<string, unknown> = {}): RawToolCall =>
	call('save_food', { name: 'Сир Карпатський', per100g, category: 'cheese', ...overrides })
const fromItem = (overrides: Record<string, unknown> = {}): RawToolCall =>
	call('save_food', { name: 'Яйце варене', fromItemIndex: 0, ...overrides })
const saveFact = (overrides: Record<string, unknown> = {}): RawToolCall =>
	call('save_fact', { text: 'Не їсть рибу', category: 'FOOD', explicit: true, ...overrides })
const forget = (ref: string): RawToolCall => call('forget_fact', { ref })

const getErrors = (calls: RawToolCall[]): string => {
	const result = parseToolCalls(calls, refs)
	if (result.ok) throw new Error('expected a rejection')
	return result.errors.join(' | ')
}

describe('parseToolCalls with the memory tools', () => {
	it('reads save_food with values next to a reply, defaults filled', () => {
		const result = parseToolCalls([fromValues(), reply], refs)

		expect(result).toMatchObject({
			ok: true,
			decision: {
				kind: 'reply',
				memory: {
					foods: [{ name: 'Сир Карпатський', aliases: [], updateRef: null }],
					fact: null,
					forgets: [],
				},
			},
		})
	})

	it('falls back to plate for a category the model made up, like log_food', () => {
		const result = parseToolCalls([fromValues({ category: 'кабаноси' }), reply], refs)

		expect(result).toMatchObject({
			ok: true,
			decision: { memory: { foods: [{ category: 'plate' }] } },
		})
	})

	it('reads save_food from a log_food item next to it', () => {
		const result = parseToolCalls([logFood, fromItem()], refs)

		expect(result).toMatchObject({
			ok: true,
			decision: { kind: 'log', memory: { foods: [{ fromItemIndex: 0, per100g: null }] } },
		})
	})

	it('reads save_fact and forget_fact next to a reply', () => {
		const result = parseToolCalls([saveFact(), forget('f2'), reply], refs)

		expect(result).toMatchObject({
			ok: true,
			decision: {
				kind: 'reply',
				memory: { fact: { text: 'Не їсть рибу', explicit: true }, forgets: [{ ref: 'f2' }] },
			},
		})
	})

	it('carries memory next to an edit answer', () => {
		const result = parseToolCalls([call('delete_entry', { refs: ['e1'] }), saveFact(), reply], {
			...refs,
			entries: new Map([['e1', { ref: 'e1' } as never]]),
		})

		expect(result).toMatchObject({ ok: true, decision: { kind: 'edit', memory: { fact: {} } } })
	})

	it('has an empty memory when no memory tool is used', () => {
		const result = parseToolCalls([reply], refs)

		expect(result).toMatchObject({
			ok: true,
			decision: { memory: { foods: [], fact: null, forgets: [] } },
		})
	})

	it('puts a one-line fact text together', () => {
		const result = parseToolCalls([saveFact({ text: '  Не  їсть\nрибу ' }), reply], refs)

		expect(result).toMatchObject({
			ok: true,
			decision: { memory: { fact: { text: 'Не їсть рибу' } } },
		})
	})

	it('does not reject a fact the guard would refuse — the backend answers instead', () => {
		const result = parseToolCalls([saveFact({ text: 'Має діабет' }), reply], refs)

		expect(result.ok).toBe(true)
	})

	it('rejects a fact text over 120 characters', () => {
		expect(getErrors([saveFact({ text: 'а'.repeat(121) }), reply])).toContain('save_fact: text')
	})

	it.each([
		['not_food', call('not_food', { reply: 'Це не їжа.' })],
		['photo_unusable', call('photo_unusable', { reason: 'no_food', reply: 'Не бачу їжі.' })],
		['show_day', call('show_day', { date: null, reply: 'Ось день.' })],
		['close_day', call('close_day', { date: null, estimatedTotalKcal: null, reply: 'Закрито.' })],
		['show_stats', call('show_stats', { days: 7, endDate: null, reply: 'Ось тиждень.' })],
	])('rejects memory next to %s', (_name, answer) => {
		expect(getErrors([saveFact(), answer])).toContain('go together with log_food or reply')
	})

	it('rejects memory next to a workout-only answer', () => {
		const workout = call('log_workout', {
			exercises: [{ name: 'Жим', kind: 'STRENGTH', sets: [{ reps: 8, weightKg: 80, count: 3 }] }],
			reply: 'Записав.',
		})

		expect(getErrors([saveFact(), workout])).toContain('go together with log_food or reply')
	})

	it('rejects memory without any answer', () => {
		expect(getErrors([saveFact()])).toContain('exactly one')
	})

	it('rejects a second save_fact', () => {
		expect(getErrors([saveFact(), saveFact({ text: 'Спить до 8' }), reply])).toContain(
			'save_fact: at most one',
		)
	})

	it('reports a second save_fact next to a too long one, so one retry fixes both', () => {
		const errors = getErrors([
			saveFact({ text: 'а'.repeat(121) }),
			saveFact({ explicit: false }),
			reply,
		])

		expect(errors).toContain('save_fact: text')
		expect(errors).toContain('save_fact: at most one')
	})

	it('reports only the broken call when there is one save_fact', () => {
		expect(getErrors([saveFact({ text: 'а'.repeat(121) }), reply])).not.toContain('at most one')
	})

	it('rejects more than five foods and five forgets', () => {
		const foods = Array.from({ length: 6 }, (_, index) => fromValues({ name: `Їжа ${index}` }))
		expect(getErrors([...foods, reply])).toContain('save_food: at most 5')
		const forgets = Array.from({ length: 6 }, () => forget('f1'))
		expect(getErrors([...forgets, reply])).toContain('forget_fact: at most 5')
	})

	describe('save_food values', () => {
		it('needs per100g and category without fromItemIndex', () => {
			expect(getErrors([call('save_food', { name: 'Сир' }), reply])).toContain(
				'needs per100g and category, or fromItemIndex',
			)
			expect(getErrors([fromValues({ category: null }), reply])).toContain('needs per100g')
		})

		it('rejects fromItemIndex together with per100g or category', () => {
			expect(getErrors([logFood, fromItem({ per100g })])).toContain(
				'leave per100g and category null',
			)
			expect(getErrors([logFood, fromItem({ category: 'eggs' })])).toContain('leave per100g')
		})

		it('rejects fromItemIndex without log_food or past the last item', () => {
			expect(getErrors([fromItem(), reply])).toContain('has no log_food')
			expect(getErrors([logFood, fromItem({ fromItemIndex: 1 })])).toContain(
				'fromItemIndex 1 is not a log_food item',
			)
		})

		it('rejects per100g that cannot be real', () => {
			expect(getErrors([fromValues({ per100g: { ...per100g, kcal: 1000 } }), reply])).toContain(
				'save_food: per100g.kcal',
			)
			expect(
				getErrors([fromValues({ per100g: { ...per100g, fat: 90, carbs: 30 } }), reply]),
			).toContain('per100g.protein')
		})
	})

	describe('save_food refs', () => {
		it('accepts updateRef of this request', () => {
			const result = parseToolCalls(
				[fromValues({ name: 'Кабаноси', updateRef: 'm1' }), reply],
				refs,
			)

			expect(result.ok).toBe(true)
		})

		it('rejects an updateRef that is not in the context', () => {
			expect(getErrors([fromValues({ updateRef: 'm9' }), reply])).toContain(
				'updateRef "m9" is not in "Saved foods"',
			)
		})

		it('asks to update instead of saving a name that is saved already', () => {
			expect(getErrors([fromValues({ name: ' кабаноси ' }), reply])).toContain(
				'already saved as m1 — ask the user in the reply whether to update it, or set updateRef',
			)
		})
	})

	describe('forget_fact', () => {
		it('rejects a ref outside "User facts"', () => {
			expect(getErrors([forget('f7'), reply])).toContain('forget_fact: f7 is not in "User facts"')
		})

		it('rejects every ref when the context has no facts', () => {
			const result = parseToolCalls([forget('f1'), reply], { ...refs, factRefs: undefined })

			expect(result.ok).toBe(false)
		})
	})
})

const forgetFood = (ref: string, confirmed: boolean): RawToolCall =>
	call('forget_food', { ref, confirmed })
const restoreFood = (ref: string): RawToolCall => call('restore_food', { ref })

describe('parseToolCalls with forget_food and restore_food', () => {
	it('reads the question: confirmed false with a reply', () => {
		const result = parseToolCalls([forgetFood('m1', false), reply], refs)

		expect(result).toMatchObject({
			ok: true,
			decision: {
				kind: 'reply',
				memory: { foodRemovals: [{ ref: 'm1', confirmed: false }], foodRestores: [] },
			},
		})
	})

	it('reads the agreed removal of a food from "Foods to remove"', () => {
		const result = parseToolCalls([forgetFood('m2', true), reply], refs)

		expect(result).toMatchObject({
			ok: true,
			decision: { memory: { foodRemovals: [{ ref: 'm2', confirmed: true }] } },
		})
	})

	it('refuses confirmed true for a food that was not asked about', () => {
		expect(getErrors([forgetFood('m1', true), reply])).toContain('ask first with confirmed false')
	})

	it('refuses a ref that is in neither the saved foods nor the foods to remove', () => {
		expect(getErrors([forgetFood('m9', false), reply])).toContain('m9 is not in')
	})

	it('wants one confirmed value, at most three foods and each ref once', () => {
		expect(getErrors([forgetFood('m1', false), forgetFood('m2', true), reply])).toContain(
			'same confirmed',
		)
		expect(getErrors([forgetFood('m1', false), forgetFood('m1', false), reply])).toContain(
			'each ref once',
		)
		const four = ['m1', 'm2', 'm3', 'm1'].map((ref) => forgetFood(ref, false))
		expect(getErrors([...four, reply])).toContain('at most 3')
	})

	it('keeps the question for reply: confirmed false does not go with log_food', () => {
		expect(getErrors([forgetFood('m1', false), logFood])).toContain('not together with log_food')
	})

	it('lets the agreed removal go next to log_food', () => {
		expect(parseToolCalls([forgetFood('m2', true), logFood], refs).ok).toBe(true)
	})

	it('refuses one food removed and used in the same answer', () => {
		expect(
			getErrors([
				forgetFood('m2', true),
				call('log_food', {
					items: [{ ...egg, memoryRef: 'm2' }],
					mealType: null,
					reply: 'Записав.',
				}),
			]),
		).toContain('choose one')
		expect(getErrors([forgetFood('m1', false), fromValues({ updateRef: 'm1' }), reply])).toContain(
			'choose one',
		)
	})

	it('goes only with log_food or reply', () => {
		expect(
			getErrors([forgetFood('m1', false), call('not_food', { reply: 'Це не їжа.' })]),
		).toContain('go together with log_food or reply')
	})

	it('reads restore_food for a food forgotten today', () => {
		const result = parseToolCalls([restoreFood('g1'), reply], refs)

		expect(result).toMatchObject({
			ok: true,
			decision: { memory: { foodRestores: [{ ref: 'g1' }], foodRemovals: [] } },
		})
	})

	it('refuses restore_food for a ref outside "Foods forgotten today" and a fourth one', () => {
		expect(getErrors([restoreFood('g7'), reply])).toContain('g7 is not in "Foods forgotten today"')
		const many = ['g1', 'g2', 'g1', 'g2'].map(restoreFood)
		expect(getErrors([...many, reply])).toContain('at most 3')
	})
})
