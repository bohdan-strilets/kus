import { WORKOUT_APPEND_MAX_GAP_HOURS } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { buildAutoClosedText, getHoursWord, WORKOUT_SUMMARY_TEXT } from './chat.constants'

const MIN_GAP_HOURS = 2
const MAX_GAP_HOURS = 4

describe('getHoursWord', () => {
	it.each([
		[1, 'година'],
		[2, 'години'],
		[3, 'години'],
		[4, 'години'],
		[5, 'годин'],
		[11, 'годин'],
		[12, 'годин'],
		[14, 'годин'],
		[20, 'годин'],
		[21, 'година'],
		[22, 'години'],
		[24, 'години'],
		[25, 'годин'],
	])('%i → %s', (hours, word) => {
		expect(getHoursWord(hours)).toBe(word)
	})
})

describe('buildAutoClosedText', () => {
	it('declines the hours word for any number', () => {
		expect(buildAutoClosedText(1)).toBe(
			'Закрив {{name}} — після останнього підходу минуло понад 1 година.',
		)
		expect(buildAutoClosedText(2)).toContain('понад 2 години.')
		expect(buildAutoClosedText(5)).toContain('понад 5 годин.')
		expect(buildAutoClosedText(11)).toContain('понад 11 годин.')
		expect(buildAutoClosedText(22)).toContain('понад 22 години.')
	})
})

describe('WORKOUT_SUMMARY_TEXT.autoClosed', () => {
	it('is exactly the approved sentence for the current gap', () => {
		expect(WORKOUT_SUMMARY_TEXT.autoClosed).toBe(
			'Закрив {{name}} — після останнього підходу минуло понад 3 години.',
		)
	})

	it('guard: the approved phrase was written for a gap of 2–4 hours', () => {
		const message =
			'autoClosed phrase was approved with the plural «години»; WORKOUT_APPEND_MAX_GAP_HOURS must stay within 2–4 or the phrase text must be reviewed with the author'
		// widened from the literal type on purpose: the guard must still compile when the constant changes
		const gapHours: number = WORKOUT_APPEND_MAX_GAP_HOURS
		expect(gapHours >= MIN_GAP_HOURS && gapHours <= MAX_GAP_HOURS, message).toBe(true)
	})
})
