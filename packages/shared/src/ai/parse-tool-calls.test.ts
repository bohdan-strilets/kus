import { describe, expect, it } from 'vitest'

import { filterClarifications, isMultiMealLog, isRenameClarification } from './clarifications.js'
import type { ParseRefs } from './entry-edits.js'
import { parseToolCalls, type RawToolCall } from './parse-tool-calls.js'
import { logFoodInputSchema } from './tools.js'

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

const soup = {
	...egg,
	name: 'Суп',
	grams: 300,
	quantity: null,
	kcal: 150,
	protein: 6,
	fat: 6,
	carbs: 18,
	category: 'soup',
	source: 'ESTIMATE',
	confidence: 0.4,
}

/** A consistent option: all kcal from carbs. */
const option = (label: string, kcal: number) => ({
	label,
	kcal,
	protein: 0,
	fat: 0,
	carbs: kcal / 4,
	fiber: null,
	grams: null,
	name: null,
})

const call = (name: string, input: unknown): RawToolCall => ({
	name,
	arguments: JSON.stringify(input),
})

const logFood = (items: unknown[]): RawToolCall =>
	call('log_food', { items, mealType: null, reply: 'Записав!' })

const options: ParseRefs = {
	memoryRefs: new Set(['m1']),
	entries: new Map(),
	deletedEntryRefs: new Set(),
	clarifications: new Map(),
}

describe('parseToolCalls', () => {
	it('returns a log decision for a valid log_food', () => {
		const result = parseToolCalls([logFood([egg])], options)
		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.decision.kind).toBe('log')
		expect(result.calls[0]?.status).toBe('SUCCEEDED')
	})

	it('rejects invalid JSON with a message the model can act on', () => {
		const result = parseToolCalls([{ name: 'log_food', arguments: '{"items": [' }], options)
		expect(result).toMatchObject({ ok: false, errors: ['log_food: arguments are not valid JSON'] })
		expect(result.calls[0]?.status).toBe('REJECTED')
	})

	it('explains a macros mismatch in the error', () => {
		const result = parseToolCalls([logFood([{ ...egg, kcal: 400 }])], options)
		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.errors[0]).toContain('items.0.kcal: kcal does not match')
	})

	it('rejects an unknown tool', () => {
		const result = parseToolCalls([call('get_weather', {})], options)
		expect(result).toMatchObject({ ok: false, errors: ['unknown tool "get_weather"'] })
	})

	it('rejects an empty answer', () => {
		expect(parseToolCalls([], options).ok).toBe(false)
	})

	it('rejects log_food together with reply', () => {
		const result = parseToolCalls([logFood([egg]), call('reply', { text: 'Привіт' })], options)
		expect(result.ok).toBe(false)
	})

	it('rejects clarify without log_food', () => {
		const clarify = call('clarify', {
			question: '?',
			itemIndexes: [0],
			options: [option('a', 100), option('b', 300)],
		})
		expect(parseToolCalls([clarify, call('reply', { text: 'Ок' })], options).ok).toBe(false)
	})

	it('rejects a memory ref the backend did not give', () => {
		const item = { ...egg, source: 'MEMORY', memoryRef: 'm7' }
		const result = parseToolCalls([logFood([item])], options)
		expect(result).toMatchObject({ ok: false })
	})

	it('rejects a memory ref on a corrected estimate, so the correction is not overwritten', () => {
		const item = { ...egg, source: 'ESTIMATE', memoryRef: 'm1' }
		const result = parseToolCalls([logFood([item])], options)
		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.errors[0]).toContain('has memoryRef but source ESTIMATE')
	})

	it('accepts a memory ref from the context', () => {
		const item = { ...egg, source: 'MEMORY', memoryRef: 'm1' }
		expect(parseToolCalls([logFood([item])], options).ok).toBe(true)
	})

	it('rejects clarify indexes outside the logged items', () => {
		const clarify = call('clarify', {
			question: 'Яка тарілка?',
			itemIndexes: [3],
			options: [option('Мала', 100), option('Велика', 300)],
		})
		expect(parseToolCalls([logFood([soup]), clarify], options).ok).toBe(false)
	})

	it('rejects repeated clarify indexes so the model fixes them on the retry', () => {
		const clarify = call('clarify', {
			question: 'Яка тарілка?',
			itemIndexes: [0, 0],
			options: [option('Мала', 100), option('Велика', 300)],
		})
		const result = parseToolCalls([logFood([soup]), clarify], options)
		expect(result).toMatchObject({ ok: false })
		if (result.ok) return
		expect(result.errors[0]).toContain('itemIndexes must not repeat')
	})

	it('accepts options whose values add up', () => {
		const clarify = call('clarify', {
			question: 'Яка тарілка?',
			itemIndexes: [0],
			options: [option('Мала', 100), { ...option('Велика', 300), grams: 500 }],
		})
		expect(parseToolCalls([logFood([soup]), clarify], options).ok).toBe(true)
	})

	it('rejects an option whose kcal does not match its macros', () => {
		const clarify = call('clarify', {
			question: 'З олією?',
			itemIndexes: [0],
			options: [option('Без олії', 150), { ...option('З олією', 240), fat: 10 }],
		})
		const result = parseToolCalls([logFood([soup]), clarify], options)
		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.errors[0]).toContain('options.1.kcal does not match')
	})

	it('rejects an option denser than 9.5 kcal per gram of the items or its own grams', () => {
		const clarify = call('clarify', {
			question: 'Яка тарілка?',
			itemIndexes: [0],
			options: [option('Мала', 150), { ...option('Велика', 1000), grams: 100 }],
		})
		const result = parseToolCalls([logFood([soup]), clarify], options)
		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.errors[0]).toContain('options.1.kcal is above 9.5 kcal per gram')
	})

	it('rejects an option a tap could not split over its items', () => {
		const salad = { ...soup, name: 'Салат', grams: 200, kcal: 40, protein: 2, fat: 0, carbs: 8 }
		const oil = { ...soup, name: 'Олія', grams: 10, kcal: 90, protein: 0, fat: 10, carbs: 0 }
		const clarify = call('clarify', {
			question: 'Скільки олії?',
			itemIndexes: [0, 1],
			// split 40 : 90 by kcal, the oil would get ~173 kcal on its 10 g
			options: [
				{ ...option('Мало', 130), protein: 2, fat: 10, carbs: 8 },
				{ ...option('Багато', 250), protein: 1, fat: 26, carbs: 0 },
			],
		})
		const result = parseToolCalls([logFood([salad, oil]), clarify], options)
		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.errors[0]).toContain('options.1 split over items')
	})

	it('renames an item only in a question about one item', () => {
		const pasta = {
			...soup,
			name: 'Макарони варені',
			grams: 100,
			kcal: 160,
			protein: 6,
			fat: 1,
			carbs: 31,
		}
		const dry = { ...option('Сухі', 360), name: 'Макарони сухі' }
		const single = call('clarify', {
			question: 'Варені чи сухі?',
			itemIndexes: [0],
			options: [option('Варені', 160), dry],
		})
		expect(parseToolCalls([logFood([pasta]), single], options).ok).toBe(true)
		const both = call('clarify', {
			question: 'Варені чи сухі?',
			itemIndexes: [0, 1],
			options: [option('Варені', 320), { ...dry, kcal: 720, carbs: 180 }],
		})
		const result = parseToolCalls([logFood([pasta, pasta]), both], options)
		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.errors.join(' ')).toContain('name is only for a question about one item')
	})

	it('does not check macros of options about a drink with alcohol', () => {
		const wine = {
			...soup,
			name: 'Вино',
			category: 'alcohol',
			kcal: 170,
			protein: 0,
			fat: 0,
			carbs: 5,
		}
		const clarify = call('clarify', {
			question: 'Яке вино?',
			itemIndexes: [0],
			options: [
				{ ...option('Сухе', 170), carbs: 5 },
				{ ...option('Солодке', 300), carbs: 30 },
			],
		})
		expect(parseToolCalls([logFood([wine]), clarify], options).ok).toBe(true)
	})

	it('returns not_food and reply decisions', () => {
		const notFood = parseToolCalls([call('not_food', { reply: 'Камінь — не їжа 🙂' })], options)
		expect(notFood).toMatchObject({ ok: true, decision: { kind: 'not_food' } })
		const reply = parseToolCalls([call('reply', { text: 'Привіт!' })], options)
		expect(reply).toMatchObject({ ok: true, decision: { kind: 'reply', text: 'Привіт!' } })
	})
})

describe('filterClarifications', () => {
	const log = logFoodInputSchema.parse({
		items: [soup, egg],
		mealType: null,
		reply: 'Ок',
	})

	const clarify = (itemIndexes: number[], kcals: number[]) => ({
		question: '?',
		itemIndexes,
		options: kcals.map((kcal, index) => option(`o${index}`, kcal)),
		kind: 'value' as const,
	})

	/** «свинячі крильця» → which real food: options with their own names, close in kcal. */
	const rename = (names: (string | null)[], kcals: number[], itemIndexes = [0]) => ({
		question: 'Що це було?',
		itemIndexes,
		options: names.map((name, index) => ({
			...option(name ?? `o${index}`, kcals[index] ?? 0),
			name,
		})),
		kind: 'rename' as const,
	})

	it('keeps a question that changes kcal by 80+ and 15%+', () => {
		const [selected] = filterClarifications(log, [clarify([0], [120, 350])])
		expect(selected?.impactKcal).toBe(230)
	})

	it('drops a question below 80 kcal', () => {
		expect(filterClarifications(log, [clarify([0], [120, 190])])).toEqual([])
	})

	it('drops a question below 15 % of the referenced items', () => {
		// soup + eggs = 383 kcal; 15 % = 57 → 80 passes the share but…
		expect(filterClarifications(log, [clarify([0, 1], [1000, 1085])])).toHaveLength(1)
		// …the same 85 kcal swing on a 1000 kcal item is noise
		const heavy = { ...log, items: log.items.slice(0, 1).map((item) => ({ ...item, kcal: 1000 })) }
		expect(filterClarifications(heavy, [clarify([0], [1000, 1085])])).toEqual([])
	})

	it('keeps at most 2 questions, the largest impact first', () => {
		const selected = filterClarifications(log, [
			clarify([0], [100, 200]),
			clarify([0], [100, 400]),
			clarify([1], [100, 250]),
		])
		expect(selected.map((item) => item.impactKcal)).toEqual([300, 150])
	})

	describe('a rename question (which food it really was)', () => {
		it('is kept even when the foods are close in kcal', () => {
			const wings = rename(['Курячі крильця', 'Свинячі ребра'], [150, 170])
			expect(isRenameClarification(wings)).toBe(true)
			expect(filterClarifications(log, [wings])).toHaveLength(1)
		})

		it('goes before a bigger question about amounts', () => {
			const selected = filterClarifications(log, [
				clarify([1], [100, 400]),
				clarify([1], [100, 300]),
				rename(['Курячі крильця', 'Свинячі ребра'], [150, 170]),
			])
			expect(selected.map((item) => item.kind)).toEqual(['rename', 'value'])
		})

		it('needs every option to name its own food, so «rename» is not a way past the threshold', () => {
			const unnamed = rename(['Макарони сухі', null], [35, 13])
			const sameName = rename(['Курячі крильця', 'курячі крильця '], [150, 170])
			const twoItems = rename(['Курячі крильця', 'Свинячі ребра'], [150, 170], [0, 1])
			for (const question of [unnamed, sameName, twoItems]) {
				expect(isRenameClarification(question)).toBe(false)
				expect(filterClarifications(log, [question])).toEqual([])
			}
		})

		it('keeps the limit of one question for a whole day', () => {
			const day = logFoodInputSchema.parse({
				items: [
					{ ...soup, mealType: 'LUNCH' },
					{ ...egg, mealType: 'BREAKFAST' },
				],
				mealType: null,
				reply: 'Ок',
			})
			const selected = filterClarifications(day, [
				clarify([1], [100, 400]),
				rename(['Курячі крильця', 'Свинячі ребра'], [150, 170]),
			])
			expect(selected.map((item) => item.kind)).toEqual(['rename'])
		})
	})

	describe('for a message with several meals', () => {
		const day = logFoodInputSchema.parse({
			items: [
				{ ...soup, mealType: 'LUNCH' },
				{ ...egg, mealType: 'BREAKFAST' },
			],
			mealType: null,
			reply: 'Ок',
		})

		it('treats items in different meals as one day', () => {
			expect(isMultiMealLog(day)).toBe(true)
			expect(isMultiMealLog(log)).toBe(false)
		})

		it('keeps one question, and only with 150+ kcal of impact', () => {
			const selected = filterClarifications(day, [
				clarify([0], [100, 400]),
				clarify([1], [100, 300]),
				clarify([0], [100, 240]),
			])
			expect(selected.map((item) => item.impactKcal)).toEqual([300])
		})

		it('drops a question a single meal would keep', () => {
			const question = clarify([0], [100, 220])
			expect(filterClarifications(log, [question])).toHaveLength(1)
			expect(filterClarifications(day, [question])).toEqual([])
		})
	})
})
