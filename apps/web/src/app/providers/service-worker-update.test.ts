import { describe, expect, it } from 'vitest'

import { isQuietTrigger, shouldApplyUpdate, type UpdateMoment } from './service-worker-update'

const NOW = 1_800_000_000_000

const moment = (overrides: Partial<UpdateMoment> = {}): UpdateMoment => ({
	trigger: 'visibility-change',
	visibilityState: 'visible',
	isSending: false,
	hasDraft: false,
	hasLiveWorkout: false,
	lastApplyAt: null,
	now: NOW,
	...overrides,
})

describe('isQuietTrigger', () => {
	it('accepts a visibility change in either direction', () => {
		expect(isQuietTrigger('visibility-change', 'visible')).toBe(true)
		expect(isQuietTrigger('visibility-change', 'hidden')).toBe(true)
	})

	it('accepts a new version found while the tab is hidden, not while it is in front', () => {
		expect(isQuietTrigger('need-refresh', 'hidden')).toBe(true)
		expect(isQuietTrigger('need-refresh', 'visible')).toBe(false)
	})
})

describe('shouldApplyUpdate', () => {
	it('applies when the tab comes back and nothing is going on', () => {
		expect(shouldApplyUpdate(moment())).toBe(true)
	})

	it('applies a version found in the background', () => {
		expect(shouldApplyUpdate(moment({ trigger: 'need-refresh', visibilityState: 'hidden' }))).toBe(
			true,
		)
	})

	it('waits while the user looks at the tab', () => {
		expect(shouldApplyUpdate(moment({ trigger: 'need-refresh', visibilityState: 'visible' }))).toBe(
			false,
		)
	})

	it('never cuts a message that is being sent', () => {
		expect(shouldApplyUpdate(moment({ isSending: true }))).toBe(false)
	})

	it('never reloads over an unsent draft', () => {
		expect(shouldApplyUpdate(moment({ hasDraft: true }))).toBe(false)
	})

	it('never reloads while a live workout is open, even in the background', () => {
		expect(shouldApplyUpdate(moment({ hasLiveWorkout: true }))).toBe(false)
		expect(
			shouldApplyUpdate(
				moment({ trigger: 'need-refresh', visibilityState: 'hidden', hasLiveWorkout: true }),
			),
		).toBe(false)
	})

	it('applies once the live workout is over', () => {
		expect(shouldApplyUpdate(moment({ hasLiveWorkout: true }))).toBe(false)
		expect(shouldApplyUpdate(moment({ hasLiveWorkout: false }))).toBe(true)
	})

	it('does not apply twice in a row when the update does not take', () => {
		expect(shouldApplyUpdate(moment({ lastApplyAt: NOW - 5_000 }))).toBe(false)
		expect(shouldApplyUpdate(moment({ lastApplyAt: NOW - 120_000 }))).toBe(true)
	})
})
