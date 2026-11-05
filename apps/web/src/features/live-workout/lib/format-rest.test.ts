import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { formatRestSet, formatRestTime } from './format-rest'
import type { LiveDraftSet } from './live-draft.types'

const t = i18n.t.bind(i18n)

const set = (overrides: Partial<LiveDraftSet> = {}): LiveDraftSet => ({
	rowKey: 'set-key',
	isEdited: false,
	reps: 12,
	weightKg: 52.5,
	durationSec: null,
	distanceM: null,
	isWarmup: false,
	doneAt: null,
	...overrides,
})

describe('formatRestTime', () => {
	it.each([
		[0, '0:00'],
		[5, '0:05'],
		[59, '0:59'],
		[60, '1:00'],
		[90, '1:30'],
		[600, '10:00'],
		[5.9, '0:05'],
	])('%s s is %s', (sec, expected) => {
		expect(formatRestTime(sec)).toBe(expected)
	})

	it('negative is 0:00', () => {
		expect(formatRestTime(-10)).toBe('0:00')
	})
})

describe('formatRestSet', () => {
	it('weight × reps', () => {
		expect(formatRestSet(set(), t)).toBe('52,5 кг × 12 повт.')
	})

	it('no weight: just reps', () => {
		expect(formatRestSet(set({ weightKg: null }), t)).toBe('12 повт.')
	})

	it('zero weight counts as no weight', () => {
		expect(formatRestSet(set({ weightKg: 0 }), t)).toBe('12 повт.')
	})

	it('timed set: seconds', () => {
		expect(formatRestSet(set({ reps: null, weightKg: null, durationSec: 45 }), t)).toBe('45 с')
	})

	it('a set with nothing in it is an empty string', () => {
		expect(formatRestSet(set({ reps: null, weightKg: null }), t)).toBe('')
	})
})
