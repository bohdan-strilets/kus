import { beforeEach, describe, expect, it } from 'vitest'

import { isRouteEntry, markRouteEntryOver, resetRouteEntry } from './route-entry'

beforeEach(resetRouteEntry)

describe('route entry latch', () => {
	it('is the entry until it is closed', () => {
		expect(isRouteEntry()).toBe(true)
		expect(isRouteEntry()).toBe(true)
	})

	it('is closed for good after markRouteEntryOver, also when closed twice', () => {
		markRouteEntryOver()
		markRouteEntryOver()

		expect(isRouteEntry()).toBe(false)
	})

	it('resetRouteEntry starts a fresh page lifetime', () => {
		markRouteEntryOver()
		resetRouteEntry()

		expect(isRouteEntry()).toBe(true)
	})
})
