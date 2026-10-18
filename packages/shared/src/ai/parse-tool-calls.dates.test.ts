import { describe, expect, it } from 'vitest'

import type { ParseRefs } from './entry-edits.js'
import { parseToolCalls, type RawToolCall } from './parse-tool-calls.js'

const refs: ParseRefs = {
	memoryRefs: new Set(),
	entries: new Map(),
	deletedEntryRefs: new Set(),
	clarifications: new Map(),
	today: '2026-10-07',
	measurementDays: new Set(['WEIGHT:2026-10-06', 'WEIGHT:2026-10-02']),
}

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

const call = (name: string, input: unknown): RawToolCall => ({
	name,
	arguments: JSON.stringify(input),
})

const logFood = (input: Record<string, unknown> = {}, item: Record<string, unknown> = {}) =>
	call('log_food', { items: [{ ...egg, ...item }], mealType: null, reply: 'Записав!', ...input })

const measure = (input: Record<string, unknown>) =>
	call('log_measurement', { kind: 'WEIGHT', value: 82.4, date: null, ...input })

const reply = call('reply', { text: 'Добре' })
const showDay = (date: string | null) => call('show_day', { date, reply: 'Ось день' })
const deleteMeasurement = (input: Record<string, unknown> = {}) =>
	call('delete_measurement', { kind: 'WEIGHT', date: '2026-10-06', ...input })

const errorsOf = (calls: RawToolCall[], options: Partial<ParseRefs> = {}): string[] => {
	const result = parseToolCalls(calls, { ...refs, ...options })
	return result.ok ? [] : result.errors
}

describe('log_food dates', () => {
	it('keeps the call and item dates', () => {
		const result = parseToolCalls([logFood({ date: '2026-10-06' }, { date: '2026-10-08' })], refs)
		if (!result.ok || result.decision.kind !== 'log') throw new Error('expected a log decision')
		expect(result.decision.log.date).toBe('2026-10-06')
		expect(result.decision.log.items[0]?.date).toBe('2026-10-08')
	})

	it('defaults the dates to null', () => {
		const result = parseToolCalls([logFood()], refs)
		if (!result.ok || result.decision.kind !== 'log') throw new Error('expected a log decision')
		expect(result.decision.log.date).toBeNull()
		expect(result.decision.log.items[0]?.date).toBeNull()
	})

	it('accepts the edges: 3 days back and tomorrow', () => {
		expect(errorsOf([logFood({ date: '2026-10-04' })])).toEqual([])
		expect(errorsOf([logFood({ date: '2026-10-08' })])).toEqual([])
		expect(errorsOf([logFood({}, { date: '2026-10-04' })])).toEqual([])
	})

	it('rejects 4 days back with the window and a hint to reply', () => {
		const [error] = errorsOf([logFood({ date: '2026-10-03' })])
		expect(error).toContain('log_food: date 2026-10-03 is more than 3 days back')
		expect(error).toContain('(2026-10-04…2026-10-08)')
		expect(error).toContain('tell the user with reply')
	})

	it('rejects the day after tomorrow, on the call and on an item', () => {
		expect(errorsOf([logFood({ date: '2026-10-09' })])[0]).toContain('1 day ahead')
		expect(errorsOf([logFood({}, { date: '2026-10-09' })])[0]).toContain('items.0.date')
	})

	it('rejects a malformed date', () => {
		expect(errorsOf([logFood({ date: '7 жовтня' })])).toHaveLength(1)
	})
})

describe('log_measurement dates', () => {
	it('accepts a new value up to 3 days back and rejects 4 unless listed', () => {
		expect(errorsOf([measure({ date: '2026-10-04' }), reply])).toEqual([])
		expect(errorsOf([measure({ date: '2026-10-03' }), reply])[0]).toContain('Recent measurements')
	})

	it('accepts a fix of a listed value up to 7 days back, of the same kind only', () => {
		expect(errorsOf([measure({ date: '2026-10-02' }), reply])).toEqual([])
		expect(
			errorsOf([measure({ kind: 'WAIST', value: 94, date: '2026-10-02' }), reply]),
		).toHaveLength(1)
	})

	it('rejects older than 7 days even when listed, and tomorrow', () => {
		const old = new Set(['WEIGHT:2026-09-29'])
		const [tooOld] = errorsOf([measure({ date: '2026-09-29' }), reply], { measurementDays: old })
		expect(tooOld).toContain('more than 7 days back')
		expect(errorsOf([measure({ date: '2026-10-08' }), reply])[0]).toContain('in the future')
	})
})

describe('delete_measurement', () => {
	it('rides along with a reply and with log_food', () => {
		expect(parseToolCalls([deleteMeasurement(), reply], refs)).toMatchObject({
			ok: true,
			decision: { kind: 'reply', measurementDeletions: [{ kind: 'WEIGHT', date: '2026-10-06' }] },
		})
		expect(parseToolCalls([deleteMeasurement(), logFood()], refs)).toMatchObject({
			ok: true,
			decision: { kind: 'log', measurementDeletions: [{ kind: 'WEIGHT', date: '2026-10-06' }] },
		})
	})

	it('has no deletions by default', () => {
		expect(parseToolCalls([reply], refs)).toMatchObject({
			ok: true,
			decision: { kind: 'reply', measurementDeletions: [] },
		})
	})

	it('is not an answer by itself', () => {
		expect(errorsOf([deleteMeasurement()])).toHaveLength(1)
	})

	it('rejects a value that is not listed in the context', () => {
		expect(errorsOf([deleteMeasurement({ date: '2026-09-20' }), reply])[0]).toContain(
			'no WEIGHT on 2026-09-20',
		)
		expect(errorsOf([deleteMeasurement({ kind: 'WAIST' }), reply])).toHaveLength(1)
	})

	it('cannot be logged again in the same message', () => {
		expect(errorsOf([deleteMeasurement(), measure({ date: '2026-10-06' }), reply])[0]).toContain(
			'one change per value',
		)
	})

	it('cannot go with not_food or show_day', () => {
		expect(errorsOf([deleteMeasurement(), call('not_food', { reply: 'Камінь' })])).toHaveLength(1)
		expect(errorsOf([deleteMeasurement(), showDay(null)])).toHaveLength(1)
	})
})

describe('show_day', () => {
	it('is an answer by itself, for today and for another day', () => {
		expect(parseToolCalls([showDay(null)], refs)).toMatchObject({
			ok: true,
			decision: { kind: 'day', date: null, text: 'Ось день' },
		})
		expect(parseToolCalls([showDay('2026-09-01')], refs)).toMatchObject({
			ok: true,
			decision: { kind: 'day', date: '2026-09-01' },
		})
	})

	it('accepts tomorrow and rejects the day after', () => {
		expect(errorsOf([showDay('2026-10-08')])).toEqual([])
		expect(errorsOf([showDay('2026-10-09')])[0]).toContain('later than tomorrow')
	})

	it('does not combine with another answer, edits or measurements', () => {
		expect(errorsOf([showDay(null), reply])).toHaveLength(1)
		expect(errorsOf([showDay(null), logFood()])).toHaveLength(1)
		expect(errorsOf([showDay(null), call('not_food', { reply: 'Камінь' })])).toHaveLength(1)
		expect(errorsOf([showDay(null), call('delete_entry', { refs: ['e1'] })])).toHaveLength(1)
		expect(errorsOf([showDay(null), measure({})])).toHaveLength(1)
		expect(errorsOf([showDay(null), showDay('2026-10-06')])).toHaveLength(1)
	})
})
