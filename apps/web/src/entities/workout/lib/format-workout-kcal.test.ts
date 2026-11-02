import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { formatWorkoutKcal } from './format-workout-kcal'

const t = i18n.t.bind(i18n)

// the thousands separator is a no-break space: compare with a plain one
const plain = (text: string | undefined): string | undefined => text?.replace(/\s/g, ' ')

describe('formatWorkoutKcal', () => {
	it('says an estimate with «≈» and «оцінка»', () => {
		const view = formatWorkoutKcal({ value: 350, source: 'ESTIMATE' }, t)

		expect(view).toEqual({
			value: '≈ 350 ккал',
			note: '≈ 350 ккал · оцінка',
			tail: ' · оцінка',
			kind: 'estimate',
		})
	})

	it('says a number the person named as it is, with «зі слів»', () => {
		const view = formatWorkoutKcal({ value: 380, source: 'MANUAL' }, t)

		expect(view?.value).toBe('380 ккал')
		expect(view?.note).toBe('380 ккал · зі слів')
		expect(view?.tail).toBe(' · зі слів')
		expect(view?.kind).toBe('named')
	})

	it('says a number from a device as it is, with «з табло»', () => {
		const view = formatWorkoutKcal({ value: 320, source: 'DEVICE' }, t)

		expect(view?.note).toBe('320 ккал · з табло')
		expect(view?.note).not.toContain('≈')
		expect(view?.kind).toBe('named')
	})

	it('has no view without a number, so a screen draws nothing', () => {
		expect(formatWorkoutKcal(null, t)).toBeNull()
	})

	it('groups the thousands', () => {
		expect(plain(formatWorkoutKcal({ value: 2100, source: 'ESTIMATE' }, t)?.value)).toBe(
			'≈ 2 100 ккал',
		)
		expect(plain(formatWorkoutKcal({ value: 2100, source: 'MANUAL' }, t)?.note)).toBe(
			'2 100 ккал · зі слів',
		)
	})

	it('shows the value rounded to a whole number', () => {
		expect(formatWorkoutKcal({ value: 349.6, source: 'ESTIMATE' }, t)?.value).toBe('≈ 350 ккал')
	})

	it('keeps zero as a number, not as «no number»', () => {
		expect(formatWorkoutKcal({ value: 0, source: 'MANUAL' }, t)?.value).toBe('0 ккал')
	})
})
