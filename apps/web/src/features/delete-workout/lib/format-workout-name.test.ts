import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { makeWorkout } from '@/shared/testing'

import { formatWorkoutName } from './format-workout-name'

const t = i18n.t.bind(i18n)
const screenName = (overrides: Parameters<typeof makeWorkout>[0]) =>
	formatWorkoutName(makeWorkout(overrides), t, { placement: 'screen' })

describe('formatWorkoutName', () => {
	it('names a chat card by the place and the start', () => {
		expect(formatWorkoutName(makeWorkout({ startedAt: null }), t)).toBe('Зал')
		expect(formatWorkoutName(makeWorkout(), t)).toMatch(/^Зал, \d{2}:\d{2}$/)
	})

	it('names the screen as its header: the place and the duration', () => {
		expect(screenName({ place: 'HOME', durationMin: 30 })).toBe('Вдома, 30 хв')
		expect(screenName({ durationMin: null, estimatedDurationMin: 62 })).toBe('Зал, ≈ 62 хв')
		expect(screenName({ durationMin: null, estimatedDurationMin: null })).toBe('Зал')
	})
})
