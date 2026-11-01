import { describe, expect, it } from 'vitest'

import { getIsoWeekday, getNextTemplate, type GetNextTemplateInput } from './next-template.js'

const KEY_A = '00000000-0000-4000-8000-00000000000a'
const KEY_B = '00000000-0000-4000-8000-00000000000b'
const KEY_C = '00000000-0000-4000-8000-00000000000c'
const KEY_UNKNOWN = '00000000-0000-4000-8000-0000000000ff'

// 2026-11-01 is a Sunday
const SUNDAY = '2026-11-01'
const MONDAY = '2026-11-02'

const input = (overrides: Partial<GetNextTemplateInput>): GetNextTemplateInput => ({
	mode: 'ROTATE',
	templates: [
		{ key: KEY_A, position: 0, weekdays: [] },
		{ key: KEY_B, position: 1, weekdays: [] },
		{ key: KEY_C, position: 2, weekdays: [] },
	],
	pinnedTemplateKey: null,
	lastTemplatedWorkout: null,
	today: MONDAY,
	...overrides,
})

describe('getIsoWeekday', () => {
	it('maps Monday to 1 and Sunday to 7', () => {
		expect(getIsoWeekday(MONDAY)).toBe(1)
		expect(getIsoWeekday(SUNDAY)).toBe(7)
	})
})

describe('getNextTemplate — ROTATE', () => {
	it('takes the template after the last one', () => {
		const last = { templateKey: KEY_A, localDate: '2026-10-30' }
		expect(getNextTemplate(input({ lastTemplatedWorkout: last }))).toEqual({
			key: KEY_B,
			weekday: null,
			date: null,
			isToday: false,
		})
	})

	it('wraps from the last template to the first', () => {
		const last = { templateKey: KEY_C, localDate: '2026-10-30' }
		expect(getNextTemplate(input({ lastTemplatedWorkout: last }))?.key).toBe(KEY_A)
	})

	it('starts from the first when the last key is not in the current version', () => {
		const last = { templateKey: KEY_UNKNOWN, localDate: '2026-10-30' }
		expect(getNextTemplate(input({ lastTemplatedWorkout: last }))?.key).toBe(KEY_A)
	})

	it('starts from the first when there was no workout', () => {
		expect(getNextTemplate(input({}))?.key).toBe(KEY_A)
	})

	it('follows position, not array order', () => {
		const templates = [
			{ key: KEY_C, position: 2, weekdays: [] },
			{ key: KEY_A, position: 0, weekdays: [] },
			{ key: KEY_B, position: 1, weekdays: [] },
		]
		const last = { templateKey: KEY_A, localDate: '2026-10-30' }
		expect(getNextTemplate(input({ templates, lastTemplatedWorkout: last }))?.key).toBe(KEY_B)
	})

	it('returns null without templates', () => {
		expect(getNextTemplate(input({ templates: [] }))).toBeNull()
	})
})

describe('getNextTemplate — SINGLE', () => {
	it('returns the pinned template', () => {
		expect(getNextTemplate(input({ mode: 'SINGLE', pinnedTemplateKey: KEY_B }))).toEqual({
			key: KEY_B,
			weekday: null,
			date: null,
			isToday: false,
		})
	})

	it('falls back to the first when the pinned key is missing or null', () => {
		const missing = input({ mode: 'SINGLE', pinnedTemplateKey: KEY_UNKNOWN })
		expect(getNextTemplate(missing)?.key).toBe(KEY_A)
		expect(getNextTemplate(input({ mode: 'SINGLE', pinnedTemplateKey: null }))?.key).toBe(KEY_A)
	})

	it('ignores the last workout', () => {
		const last = { templateKey: KEY_B, localDate: MONDAY }
		const result = getNextTemplate(
			input({ mode: 'SINGLE', pinnedTemplateKey: KEY_B, lastTemplatedWorkout: last }),
		)
		expect(result?.key).toBe(KEY_B)
	})

	it('returns null without templates', () => {
		expect(getNextTemplate(input({ mode: 'SINGLE', templates: [] }))).toBeNull()
	})
})

describe('getNextTemplate — WEEKDAYS', () => {
	const templates = [
		{ key: KEY_A, position: 0, weekdays: [1] },
		{ key: KEY_B, position: 1, weekdays: [3] },
	]
	const weekdays = (overrides: Partial<GetNextTemplateInput>): GetNextTemplateInput =>
		input({ mode: 'WEEKDAYS', templates, ...overrides })

	it('suggests today when today has a template', () => {
		expect(getNextTemplate(weekdays({ today: MONDAY }))).toEqual({
			key: KEY_A,
			weekday: 1,
			date: MONDAY,
			isToday: true,
		})
	})

	it('moves to the next day with a template when today is already done', () => {
		const last = { templateKey: KEY_A, localDate: MONDAY }
		expect(getNextTemplate(weekdays({ lastTemplatedWorkout: last }))).toEqual({
			key: KEY_B,
			weekday: 3,
			date: '2026-11-04',
			isToday: false,
		})
	})

	it('still suggests today when the done workout was on an earlier date', () => {
		const last = { templateKey: KEY_A, localDate: '2026-10-26' }
		expect(getNextTemplate(weekdays({ lastTemplatedWorkout: last }))?.isToday).toBe(true)
	})

	it('scans into the next week when the only template today is done', () => {
		const only = [{ key: KEY_A, position: 0, weekdays: [1] }]
		const last = { templateKey: KEY_A, localDate: MONDAY }
		expect(getNextTemplate(weekdays({ templates: only, lastTemplatedWorkout: last }))).toEqual({
			key: KEY_A,
			weekday: 1,
			date: '2026-11-09',
			isToday: false,
		})
	})

	it('takes the nearest following day when today has no template', () => {
		// Tuesday: Wednesday (B) is nearer than next Monday (A)
		expect(getNextTemplate(weekdays({ today: '2026-11-03' }))).toEqual({
			key: KEY_B,
			weekday: 3,
			date: '2026-11-04',
			isToday: false,
		})
	})

	it('wraps from Sunday to Monday', () => {
		expect(getNextTemplate(weekdays({ today: SUNDAY }))).toEqual({
			key: KEY_A,
			weekday: 1,
			date: MONDAY,
			isToday: false,
		})
	})

	it('picks the first template by position when two share a weekday', () => {
		const shared = [
			{ key: KEY_B, position: 1, weekdays: [1] },
			{ key: KEY_A, position: 0, weekdays: [1] },
		]
		expect(getNextTemplate(weekdays({ templates: shared }))?.key).toBe(KEY_A)
	})

	it('suggests the other template when one of two on the same day is done', () => {
		const shared = [
			{ key: KEY_A, position: 0, weekdays: [1] },
			{ key: KEY_B, position: 1, weekdays: [1] },
		]
		const last = { templateKey: KEY_A, localDate: MONDAY }
		expect(
			getNextTemplate(weekdays({ templates: shared, lastTemplatedWorkout: last })),
		).toMatchObject({ key: KEY_B, isToday: true })
	})

	it('returns null when no template has weekdays', () => {
		const none = [
			{ key: KEY_A, position: 0, weekdays: [] },
			{ key: KEY_B, position: 1, weekdays: [] },
		]
		expect(getNextTemplate(weekdays({ templates: none }))).toBeNull()
	})

	it('returns null without templates', () => {
		expect(getNextTemplate(weekdays({ templates: [] }))).toBeNull()
	})

	it('follows only the given local date string (night owl: API passes the previous date)', () => {
		// 01:00 on Sunday for the user, the API passes Saturday: Saturday's template is still "today"
		const saturday = [{ key: KEY_A, position: 0, weekdays: [6] }]
		expect(getNextTemplate(weekdays({ templates: saturday, today: '2026-10-31' }))).toEqual({
			key: KEY_A,
			weekday: 6,
			date: '2026-10-31',
			isToday: true,
		})
		expect(getNextTemplate(weekdays({ templates: saturday, today: SUNDAY }))).toMatchObject({
			date: '2026-11-07',
			isToday: false,
		})
	})

	it('marks the session done only on the given date (night owl)', () => {
		const saturday = [{ key: KEY_A, position: 0, weekdays: [6] }]
		const last = { templateKey: KEY_A, localDate: '2026-10-31' }
		const result = getNextTemplate(
			weekdays({ templates: saturday, today: '2026-10-31', lastTemplatedWorkout: last }),
		)
		expect(result).toMatchObject({ date: '2026-11-07', isToday: false })
	})
})
