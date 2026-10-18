import { describe, expect, it } from 'vitest'

import type { ParseRefs } from './entry-edits.js'
import { parseToolCalls, type RawToolCall } from './parse-tool-calls.js'

const refs: ParseRefs = {
	memoryRefs: new Set(),
	entries: new Map(),
	deletedEntryRefs: new Set(),
	clarifications: new Map(),
	today: '2026-10-07',
	measurementDays: new Set(),
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

const measure = (input: Record<string, unknown>): RawToolCall =>
	call('log_measurement', {
		kind: 'WEIGHT',
		value: 82.4,
		date: null,
		confirmedJump: false,
		...input,
	})

const reply = call('reply', { text: 'Записав' })
const logFood = call('log_food', { items: [egg], mealType: null, reply: 'Записав!' })

describe('parseToolCalls with log_measurement', () => {
	it('carries the measurements of a reply, and none when there are none', () => {
		const withWeight = parseToolCalls([measure({}), reply], refs)
		expect(withWeight).toMatchObject({
			ok: true,
			decision: { kind: 'reply', measurements: [{ kind: 'WEIGHT', value: 82.4 }] },
		})
		expect(parseToolCalls([reply], refs)).toMatchObject({
			ok: true,
			decision: { kind: 'reply', measurements: [] },
		})
	})

	it('carries weight and waist together', () => {
		const result = parseToolCalls([measure({}), measure({ kind: 'WAIST', value: 94 }), reply], refs)
		expect(result).toMatchObject({ ok: true, decision: { kind: 'reply' } })
		if (!result.ok || result.decision.kind !== 'reply') return
		expect(result.decision.measurements.map((item) => item.kind)).toEqual(['WEIGHT', 'WAIST'])
	})

	it('rides along with log_food', () => {
		const result = parseToolCalls([logFood, measure({})], refs)
		expect(result).toMatchObject({
			ok: true,
			decision: { kind: 'log', measurements: [{ kind: 'WEIGHT', value: 82.4 }] },
		})
	})

	it('is not an answer by itself', () => {
		const result = parseToolCalls([measure({})], refs)
		expect(result.ok).toBe(false)
	})

	it('cannot go with not_food or photo_unusable', () => {
		const notFood = parseToolCalls([measure({}), call('not_food', { reply: 'Камінь' })], refs)
		expect(notFood.ok).toBe(false)
		const unusable = parseToolCalls(
			[measure({}), call('photo_unusable', { reason: 'dark', reply: 'Темно' })],
			refs,
			{ hasImage: true },
		)
		expect(unusable.ok).toBe(false)
	})

	it('cannot go with an edit reply', () => {
		const result = parseToolCalls(
			[measure({}), call('delete_entry', { refs: ['e1'] }), reply],
			refs,
		)
		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.errors[0]).toContain('log_measurement goes together')
	})

	it('rejects an out-of-range value on a reply and on log_food', () => {
		for (const answer of [[reply], [logFood]]) {
			const result = parseToolCalls([measure({ value: 29.9 }), ...answer], refs)
			expect(result.ok).toBe(false)
			if (result.ok) continue
			expect(result.errors[0]).toContain('outside 30–300 kg')
		}
	})

	it('rejects a future date, two weights and a zero or negative value', () => {
		expect(parseToolCalls([measure({ date: '2026-10-08' }), reply], refs).ok).toBe(false)
		expect(parseToolCalls([measure({}), measure({ value: 83 }), reply], refs).ok).toBe(false)
		expect(parseToolCalls([measure({ value: 0 }), reply], refs).ok).toBe(false)
		expect(parseToolCalls([measure({ value: -80 }), reply], refs).ok).toBe(false)
	})

	it('rejects a log_food that is valid when its measurement is not', () => {
		const result = parseToolCalls([logFood, measure({ kind: 'WAIST', value: 201 })], refs)
		expect(result.ok).toBe(false)
	})
})

describe('parseToolCalls rounds log_measurement to one decimal before the checks', () => {
	const valueOf = (input: Record<string, unknown>): number | undefined => {
		const result = parseToolCalls([measure(input), reply], refs)
		if (!result.ok || result.decision.kind !== 'reply') return undefined
		return result.decision.measurements[0]?.value
	}
	const isAccepted = (input: Record<string, unknown>): boolean =>
		parseToolCalls([measure(input), reply], refs).ok

	it('carries the rounded value, not the raw one', () => {
		expect(valueOf({ value: 82.449 })).toBe(82.4)
		expect(valueOf({ value: 70.05 })).toBe(70.1)
		expect(valueOf({ kind: 'WAIST', value: 82.45 })).toBe(82.5)
	})

	it('rounds the value that rides along with log_food too', () => {
		const result = parseToolCalls([logFood, measure({ value: 82.449 })], refs)
		expect(result).toMatchObject({
			ok: true,
			decision: { kind: 'log', measurements: [{ value: 82.4 }] },
		})
	})

	it('checks the lower weight limit on the rounded value', () => {
		expect(isAccepted({ value: 29.96 })).toBe(true)
		expect(valueOf({ value: 29.96 })).toBe(30)
		expect(isAccepted({ value: 29.94 })).toBe(false)
	})

	it('checks the upper weight limit on the rounded value', () => {
		expect(isAccepted({ value: 300.04 })).toBe(true)
		expect(valueOf({ value: 300.04 })).toBe(300)
		const result = parseToolCalls([measure({ value: 300.05 }), reply], refs)
		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.errors[0]).toContain('outside 30–300 kg')
	})

	it('checks the waist limits (40–200 cm) on the rounded value', () => {
		const waist = (value: number) => ({ kind: 'WAIST', value })
		expect(isAccepted(waist(39.96))).toBe(true)
		expect(isAccepted(waist(39.94))).toBe(false)
		expect(isAccepted(waist(200.04))).toBe(true)
		expect(isAccepted(waist(200.05))).toBe(false)
	})
})
