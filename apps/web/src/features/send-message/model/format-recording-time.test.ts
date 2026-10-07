import { describe, expect, it } from 'vitest'

import { formatRecordingTime } from './format-recording-time'

describe('formatRecordingTime', () => {
	it('pads seconds like the mockup timer', () => {
		expect(formatRecordingTime(7)).toBe('0:07')
		expect(formatRecordingTime(75.9)).toBe('1:15')
	})

	it('never goes negative', () => {
		expect(formatRecordingTime(-3)).toBe('0:00')
	})
})
