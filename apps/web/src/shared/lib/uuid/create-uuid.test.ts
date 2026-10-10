import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { createUuid } from './create-uuid'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('createUuid', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('makes a version 4 UUID the API accepts (z.uuid)', () => {
		const id = createUuid()
		expect(id).toMatch(UUID_V4)
		expect(z.uuid().safeParse(id).success).toBe(true)
	})

	it('works without crypto.randomUUID, as in a plain-http page on the LAN', () => {
		const getRandomValues = crypto.getRandomValues.bind(crypto)
		vi.stubGlobal('crypto', { getRandomValues })
		expect(typeof crypto.randomUUID).toBe('undefined')
		expect(createUuid()).toMatch(UUID_V4)
	})

	it('does not repeat itself', () => {
		const ids = new Set(Array.from({ length: 1000 }, createUuid))
		expect(ids.size).toBe(1000)
	})
})
