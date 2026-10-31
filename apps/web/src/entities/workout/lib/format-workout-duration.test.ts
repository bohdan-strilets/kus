import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { formatWorkoutDuration } from './format-workout-duration'

const t = i18n.t.bind(i18n)

describe('formatWorkoutDuration', () => {
	it('shows a named duration as it is', () => {
		expect(formatWorkoutDuration({ durationMin: 62, estimatedDurationMin: 40 }, t)).toBe('62 хв')
	})

	it('marks an estimate with «≈»', () => {
		expect(formatWorkoutDuration({ durationMin: null, estimatedDurationMin: 62 }, t)).toBe(
			'≈ 62 хв',
		)
	})

	it('says an estimate in words for a screen reader', () => {
		expect(formatWorkoutDuration({ durationMin: null, estimatedDurationMin: 62 }, t, true)).toBe(
			'приблизно 62 хв',
		)
	})

	it('is null without either', () => {
		expect(formatWorkoutDuration({ durationMin: null, estimatedDurationMin: null }, t)).toBeNull()
	})
})
