import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { FOOTER_CARDIO_MAX_CHARS, formatFooterCounts } from './format-workout-counts'
import type { WorkoutCounts } from './get-workout-counts'

const t = i18n.t.bind(i18n)

const counts: WorkoutCounts = {
	exerciseCount: 2,
	setCount: 3,
	cardioMinutes: 10,
	hasCardio: true,
}
const TITLE_PREFIX = 'Тренування · 18:30'.length + 2

describe('formatFooterCounts', () => {
	it('the limit is 60 and «Тренування · 18:30: 2 вправи · 3 підходи · кардіо 10 хв» keeps cardio', () => {
		expect(FOOTER_CARDIO_MAX_CHARS).toBe(60)
		expect(formatFooterCounts(counts, t, TITLE_PREFIX)).toBe('2 вправи · 3 підходи · кардіо 10 хв')
	})

	it('a longer line drops only the cardio part', () => {
		const text = formatFooterCounts(counts, t, FOOTER_CARDIO_MAX_CHARS)

		expect(text).toBe('2 вправи · 3 підходи')
	})

	it('cardio alone and strength alone are told as they are', () => {
		const cardioOnly = { ...counts, exerciseCount: 0, setCount: 0 }
		const strengthOnly = { ...counts, cardioMinutes: null, hasCardio: false }

		expect(formatFooterCounts(cardioOnly, t, FOOTER_CARDIO_MAX_CHARS)).toBe('кардіо 10 хв')
		expect(formatFooterCounts(strengthOnly, t, FOOTER_CARDIO_MAX_CHARS)).toBe(
			'2 вправи · 3 підходи',
		)
	})

	it('nothing done: null', () => {
		const empty = { exerciseCount: 0, setCount: 0, cardioMinutes: null, hasCardio: false }

		expect(formatFooterCounts(empty, t, 0)).toBeNull()
	})
})
