import { describe, expect, it } from 'vitest'

import { formatSessionHeader } from '@/entities/workout'
import { i18n } from '@/shared/i18n'
import { makeWorkout } from '@/shared/testing'

import { formatFinishSubtitle } from './format-finish-subtitle'

const t = i18n.t.bind(i18n)

describe('formatFinishSubtitle', () => {
	it('is the same text as the subtitle of the session screen for a named duration', () => {
		const workout = makeWorkout({
			localDate: '2026-10-26',
			startedAt: '2026-10-26T17:30:00.000Z',
			durationMin: 62,
			estimatedDurationMin: null,
		})

		expect(formatFinishSubtitle(workout, t)).toBe(formatSessionHeader(workout, t).subtitle)
		expect(formatFinishSubtitle(workout, t)).toMatch(/·\s\d{2}:\d{2}–\d{2}:\d{2}$/)
	})

	it('without a duration it is the start alone; without a start, only the day', () => {
		const base = { localDate: '2026-10-26', durationMin: null }

		expect(formatFinishSubtitle({ ...base, startedAt: '2026-10-26T17:30:00.000Z' }, t)).toMatch(
			/^Понеділок, 26 жовтня · \d{2}:\d{2}$/,
		)
		expect(formatFinishSubtitle({ ...base, startedAt: null }, t)).toBe('Понеділок, 26 жовтня')
	})
})
