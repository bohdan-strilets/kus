import { describe, expect, it } from 'vitest'

import {
	isQuietMoment,
	RETURN_WINDOW_MS,
	shouldApplyUpdate,
	type UpdateMoment,
} from './service-worker-update'

const NOW = 1_800_000_000_000

const moment = (overrides: Partial<UpdateMoment> = {}): UpdateMoment => ({
	trigger: 'visibility-change',
	visibilityState: 'visible',
	lastVisibleAt: null,
	hasInteractedSinceVisible: false,
	hasFocusedField: false,
	isSending: false,
	hasDraft: false,
	hasLiveWorkout: false,
	lastApplyAt: null,
	now: NOW,
	...overrides,
})

/** A «need refresh» in a visible tab that came back a second ago and has not been touched. */
const justBack = (overrides: Partial<UpdateMoment> = {}): UpdateMoment =>
	moment({ trigger: 'need-refresh', lastVisibleAt: NOW - 1_000, ...overrides })

describe('isQuietMoment', () => {
	it('accepts a visibility change in either direction', () => {
		expect(isQuietMoment(moment({ visibilityState: 'visible' }))).toBe(true)
		expect(isQuietMoment(moment({ visibilityState: 'hidden' }))).toBe(true)
	})

	it('accepts a new version found while the tab is hidden', () => {
		expect(isQuietMoment(moment({ trigger: 'need-refresh', visibilityState: 'hidden' }))).toBe(true)
	})

	it('accepts a new version found within the return window of an untouched tab', () => {
		expect(isQuietMoment(justBack())).toBe(true)
		expect(isQuietMoment(justBack({ lastVisibleAt: NOW - RETURN_WINDOW_MS }))).toBe(true)
	})

	it('waits once the return window has passed', () => {
		expect(isQuietMoment(justBack({ lastVisibleAt: NOW - RETURN_WINDOW_MS - 1 }))).toBe(false)
	})

	it('waits when the tab was never marked visible', () => {
		expect(isQuietMoment(justBack({ lastVisibleAt: null }))).toBe(false)
	})

	it('waits after a tap or a key', () => {
		expect(isQuietMoment(justBack({ hasInteractedSinceVisible: true }))).toBe(false)
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

	it('applies a version found right after the tab came back or started', () => {
		expect(shouldApplyUpdate(justBack())).toBe(true)
	})

	it('does not apply a version found after the window, a touch, or with no visible mark', () => {
		expect(shouldApplyUpdate(justBack({ lastVisibleAt: NOW - RETURN_WINDOW_MS - 1 }))).toBe(false)
		expect(shouldApplyUpdate(justBack({ hasInteractedSinceVisible: true }))).toBe(false)
		expect(shouldApplyUpdate(justBack({ lastVisibleAt: null }))).toBe(false)
	})

	it('never reloads while the cursor is in a field', () => {
		expect(shouldApplyUpdate(moment({ hasFocusedField: true }))).toBe(false)
		expect(shouldApplyUpdate(justBack({ hasFocusedField: true }))).toBe(false)
	})

	it('never cuts a message that is being sent', () => {
		expect(shouldApplyUpdate(moment({ isSending: true }))).toBe(false)
		expect(shouldApplyUpdate(justBack({ isSending: true }))).toBe(false)
	})

	it('never reloads over an unsent draft', () => {
		expect(shouldApplyUpdate(moment({ hasDraft: true }))).toBe(false)
		expect(shouldApplyUpdate(justBack({ hasDraft: true }))).toBe(false)
	})

	it('never reloads while a live workout is open, even in the background', () => {
		expect(shouldApplyUpdate(moment({ hasLiveWorkout: true }))).toBe(false)
		expect(shouldApplyUpdate(justBack({ hasLiveWorkout: true }))).toBe(false)
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
		expect(shouldApplyUpdate(justBack({ lastApplyAt: NOW - 5_000 }))).toBe(false)
		expect(shouldApplyUpdate(moment({ lastApplyAt: NOW - 120_000 }))).toBe(true)
	})
})
