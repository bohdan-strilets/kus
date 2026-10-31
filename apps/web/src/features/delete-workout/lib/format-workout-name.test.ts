import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { makeWorkout } from '@/shared/testing'

import { formatWorkoutName } from './format-workout-name'

const t = i18n.t.bind(i18n)
const screenName = (overrides: Parameters<typeof makeWorkout>[0]) =>
	formatWorkoutName(makeWorkout(overrides), t)

describe('formatWorkoutName', () => {
	it('names the screen as its header: the place and the duration', () => {
		expect(screenName({ place: 'HOME', durationMin: 30 })).toBe('Вдома, 30 хв')
		expect(screenName({ durationMin: null, estimatedDurationMin: 62 })).toBe('Зал, ≈ 62 хв')
		expect(screenName({ durationMin: null, estimatedDurationMin: null })).toBe('Зал')
	})
})
