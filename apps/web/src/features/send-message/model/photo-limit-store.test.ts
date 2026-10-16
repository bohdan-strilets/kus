import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { parseResetsAt, usePhotoLimitStore } from './photo-limit-store'

const USER_ID = '0199b3a4-0000-7000-8000-00000000000a'
const OTHER_USER_ID = '0199b3a4-0000-7000-8000-00000000000b'
const NOW = Date.parse('2026-10-16T12:00:00.000Z')
const RESETS_AT = '2026-10-17T00:00:00.000Z'

describe('parseResetsAt', () => {
	it('reads an ISO time in the future', () => {
		expect(parseResetsAt(RESETS_AT, NOW)).toBe(Date.parse(RESETS_AT))
	})

	it.each([
		['a past time', '2026-10-15T00:00:00.000Z'],
		['exactly now', '2026-10-16T12:00:00.000Z'],
		['garbage', 'later'],
		['an empty string', ''],
		['a number', 1_792_000_000_000],
		['null', null],
		['undefined', undefined],
		['an object', { iso: RESETS_AT }],
	])('is null for %s', (_name, value) => {
		expect(parseResetsAt(value, NOW)).toBeNull()
	})
})

describe('photo limit store', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(NOW)
		usePhotoLimitStore.setState({ ownerId: USER_ID, blockedUntil: null })
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('blocks until the time the API gave', () => {
		usePhotoLimitStore.getState().block(RESETS_AT)

		expect(usePhotoLimitStore.getState().blockedUntil).toBe(Date.parse(RESETS_AT))
	})

	it('blocks nothing without a usable resetsAt', () => {
		for (const value of [undefined, null, 'x', 42, '2020-01-01T00:00:00.000Z']) {
			usePhotoLimitStore.getState().block(value)
			expect(usePhotoLimitStore.getState().blockedUntil).toBeNull()
		}
	})

	it('keeps the block for the same user and drops it for another one or after logout', () => {
		usePhotoLimitStore.getState().block(RESETS_AT)

		usePhotoLimitStore.getState().claim(USER_ID)
		expect(usePhotoLimitStore.getState().blockedUntil).toBe(Date.parse(RESETS_AT))

		usePhotoLimitStore.getState().claim(OTHER_USER_ID)
		expect(usePhotoLimitStore.getState()).toMatchObject({
			ownerId: OTHER_USER_ID,
			blockedUntil: null,
		})

		usePhotoLimitStore.getState().block(RESETS_AT)
		usePhotoLimitStore.getState().claim(null)
		expect(usePhotoLimitStore.getState()).toMatchObject({ ownerId: null, blockedUntil: null })
	})

	it('is not written to any storage: a reload starts unblocked', () => {
		const setItem = vi.fn()
		vi.stubGlobal('localStorage', { setItem, getItem: () => null })
		usePhotoLimitStore.getState().block(RESETS_AT)

		expect(setItem).not.toHaveBeenCalled()
		vi.unstubAllGlobals()
	})
})
