import { afterEach, describe, expect, it, vi } from 'vitest'

import {
	createSessionObjectUrl,
	revokeSessionObjectUrl,
	revokeSessionObjectUrls,
} from './object-url'

describe('session object URLs', () => {
	let counter = 0
	const create = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
		counter += 1
		return `blob:http://localhost/${counter}`
	})
	const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

	afterEach(() => {
		revokeSessionObjectUrls()
		create.mockClear()
		revoke.mockClear()
	})

	it('revokes one URL on demand and the rest when the session is left', () => {
		const first = createSessionObjectUrl(new Blob())
		const second = createSessionObjectUrl(new Blob())
		const third = createSessionObjectUrl(new Blob())

		revokeSessionObjectUrl(second)
		expect(revoke).toHaveBeenCalledWith(second)

		revokeSessionObjectUrls()
		expect(revoke.mock.calls.map(([url]) => url)).toEqual([second, first, third])
	})

	it('does not revoke a URL twice after it was already revoked', () => {
		const url = createSessionObjectUrl(new Blob())
		revokeSessionObjectUrl(url)
		revokeSessionObjectUrls()
		expect(revoke).toHaveBeenCalledTimes(1)
	})
})
