import { describe, expect, it } from 'vitest'

import { formatPace, getPaceHintKey } from './profile-labels'

describe('formatPace', () => {
	it('signs and formats each pace option', () => {
		expect(formatPace(0.25, 'LOSE')).toBe('−0,25')
		expect(formatPace(0.5, 'LOSE')).toBe('−0,5')
		expect(formatPace(0.75, 'LOSE')).toBe('−0,75')
		expect(formatPace(0.5, 'GAIN')).toBe('+0,5')
	})

	it('has no sign for MAINTAIN', () => {
		expect(formatPace(0.25, 'MAINTAIN')).toBe('0,25')
	})
})

describe('getPaceHintKey', () => {
	it('picks the hint by goal and pace, none for MAINTAIN', () => {
		expect(getPaceHintKey('LOSE', 0.25)).toBe('profile.pace.lose.p025')
		expect(getPaceHintKey('GAIN', 0.75)).toBe('profile.pace.gain.p075')
		expect(getPaceHintKey('MAINTAIN', 0.5)).toBeNull()
	})
})
