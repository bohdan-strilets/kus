import { describe, expect, it } from 'vitest'

import type { ParseRefs } from './entry-edits.js'
import { parseToolCalls, type RawToolCall } from './parse-tool-calls.js'

const refs: ParseRefs = {
	memoryRefs: new Set(['m1']),
	copyRefs: new Set(['y1', 'h1']),
	entries: new Map(),
	deletedEntryRefs: new Set(),
	clarifications: new Map(),
	today: '2026-10-19',
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

const closeDay = (input: Record<string, unknown> = {}): RawToolCall =>
	call('close_day', { date: null, estimatedTotalKcal: null, reply: 'Готово', ...input })

const showStats = (input: Record<string, unknown> = {}): RawToolCall =>
	call('show_stats', { period: 'week', endDate: null, reply: 'Ось тиждень', ...input })

const logFood = (items: unknown[]): RawToolCall =>
	call('log_food', { items, mealType: null, reply: 'Записав!' })

const reply = call('reply', { text: 'Привіт' })

const errorsOf = (calls: RawToolCall[], options: ParseRefs = refs): string => {
	const result = parseToolCalls(calls, options)
	return result.ok ? '' : result.errors.join(' | ')
}

describe('close_day', () => {
	it('closes today by default', () => {
		const result = parseToolCalls([closeDay()], refs)
		expect(result.ok && result.decision).toEqual({
			kind: 'close_day',
			date: null,
			estimatedTotalKcal: null,
			text: 'Готово',
		})
	})

	it('passes the estimate of the day and an earlier day', () => {
		const result = parseToolCalls(
			[closeDay({ date: '2026-10-17', estimatedTotalKcal: 1800 })],
			refs,
		)
		expect(result.ok && result.decision).toMatchObject({
			kind: 'close_day',
			date: '2026-10-17',
			estimatedTotalKcal: 1800,
		})
	})

	it('accepts the oldest loggable day and today by date', () => {
		expect(parseToolCalls([closeDay({ date: '2026-10-16' })], refs).ok).toBe(true)
		expect(parseToolCalls([closeDay({ date: '2026-10-19' })], refs).ok).toBe(true)
	})

	it('rejects tomorrow and days beyond the loggable window', () => {
		expect(errorsOf([closeDay({ date: '2026-10-20' })])).toContain('close_day: date 2026-10-20')
		expect(errorsOf([closeDay({ date: '2026-10-15' })])).toContain('close_day: date 2026-10-15')
	})

	it.each([0, -100, 20_001])('rejects the estimate %i', (estimatedTotalKcal) => {
		expect(errorsOf([closeDay({ estimatedTotalKcal })])).toContain('estimatedTotalKcal')
	})

	it('must stand alone', () => {
		expect(errorsOf([closeDay(), reply])).toContain('exactly one')
		expect(errorsOf([closeDay(), logFood([egg])])).toContain('exactly one')
		expect(errorsOf([closeDay(), showStats()])).toContain('exactly one')
		expect(
			errorsOf([
				closeDay(),
				call('log_measurement', { kind: 'WEIGHT', value: 80, date: null, confirmedJump: false }),
			]),
		).toContain('whole answer')
		expect(errorsOf([closeDay(), call('delete_entry', { refs: ['e1'] })])).toContain('whole answer')
	})
})

describe('show_stats', () => {
	it('shows the week or the month', () => {
		expect(parseToolCalls([showStats()], refs).ok).toBe(true)
		const month = parseToolCalls([showStats({ period: 'month', endDate: '2026-10-10' })], refs)
		expect(month.ok && month.decision).toEqual({
			kind: 'stats',
			period: 'month',
			endDate: '2026-10-10',
			text: 'Ось тиждень',
		})
	})

	it('rejects an unknown period', () => {
		expect(errorsOf([showStats({ period: 'year' })])).toContain('period')
	})

	it('allows today and earlier days as the last day, rejects the future', () => {
		expect(parseToolCalls([showStats({ endDate: '2026-10-19' })], refs).ok).toBe(true)
		expect(parseToolCalls([showStats({ endDate: '2026-10-18' })], refs).ok).toBe(true)
		expect(parseToolCalls([showStats({ endDate: '2026-10-17' })], refs).ok).toBe(true)
		expect(parseToolCalls([showStats({ endDate: null })], refs).ok).toBe(true)
		expect(errorsOf([showStats({ endDate: '2026-10-20' })])).toContain('in the future')
		expect(errorsOf([showStats({ endDate: '2026-10-25' })])).toContain('in the future')
	})

	it('must stand alone', () => {
		expect(errorsOf([showStats(), reply])).toContain('exactly one')
		expect(errorsOf([showStats(), logFood([egg])])).toContain('exactly one')
	})
})

describe('log_food copyRef', () => {
	const copied = { ...egg, copyRef: 'y1' }

	it('defaults to null', () => {
		const result = parseToolCalls([logFood([egg])], refs)
		const item = result.ok && result.decision.kind === 'log' ? result.decision.log.items[0] : null
		expect(item?.copyRef).toBeNull()
	})

	it('accepts a listed ref of yesterday and of the history', () => {
		expect(parseToolCalls([logFood([copied, { ...egg, copyRef: 'h1' }])], refs).ok).toBe(true)
	})

	it('rejects a ref that is not in the context', () => {
		expect(errorsOf([logFood([{ ...egg, copyRef: 'y2' }])])).toContain(
			'copyRef "y2" is not in "Earlier entries"',
		)
	})

	it('rejects every copyRef when the section was not in the context', () => {
		expect(errorsOf([logFood([copied])], { ...refs, copyRefs: undefined })).toContain(
			'copyRef "y1"',
		)
	})

	it('rejects a ref of the wrong shape', () => {
		expect(errorsOf([logFood([{ ...egg, copyRef: 'm1' }])])).toContain('copyRef')
		expect(errorsOf([logFood([{ ...egg, copyRef: 'e1' }])])).toContain('copyRef')
	})

	it('rejects copyRef together with memoryRef', () => {
		const both = { ...copied, memoryRef: 'm1', source: 'MEMORY' }
		expect(errorsOf([logFood([both])])).toContain('both copyRef and memoryRef')
	})

	describe('kcal that does not match the macros', () => {
		const mismatched = { ...egg, kcal: 600 }

		it('is accepted for a valid copyRef, the backend takes the numbers from the copy', () => {
			expect(parseToolCalls([logFood([{ ...mismatched, copyRef: 'y1' }])], refs).ok).toBe(true)
		})

		it('still rejects an unknown copyRef', () => {
			expect(errorsOf([logFood([{ ...mismatched, copyRef: 'y2' }])])).toContain(
				'copyRef "y2" is not in "Earlier entries"',
			)
		})

		it('still rejects a copyRef together with memoryRef', () => {
			const both = { ...mismatched, copyRef: 'y1', memoryRef: 'm1', source: 'MEMORY' }
			expect(errorsOf([logFood([both])])).toContain('both copyRef and memoryRef')
		})

		it('is still rejected without copyRef', () => {
			expect(errorsOf([logFood([mismatched])])).toContain('kcal does not')
		})

		it('keeps the density bound for a copyRef item', () => {
			expect(errorsOf([logFood([{ ...egg, kcal: 5000, copyRef: 'y1' }])])).toContain(
				'kcal per gram',
			)
		})
	})
})
