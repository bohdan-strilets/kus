import { describe, expect, it } from 'vitest'

import { buildStorageKey, buildUserPrefix } from './storage-key'

describe('buildStorageKey', () => {
	it('builds the full-size key by default', () => {
		expect(buildStorageKey({ prefix: 'dev', userId: 'u1', kind: 'photos', fileId: 'f1' })).toBe(
			'dev/users/u1/photos/f1',
		)
	})

	it('adds the thumb suffix for the thumb variant', () => {
		expect(
			buildStorageKey({
				prefix: 'dev',
				userId: 'u1',
				kind: 'photos',
				fileId: 'f1',
				variant: 'thumb',
			}),
		).toBe('dev/users/u1/photos/f1-thumb')
	})

	it('does not duplicate slashes when the prefix ends with one', () => {
		expect(buildStorageKey({ prefix: 'prod//', userId: 'u1', kind: 'photos', fileId: 'f1' })).toBe(
			'prod/users/u1/photos/f1',
		)
	})

	it('keeps a key inside its owner prefix', () => {
		const key = buildStorageKey({ prefix: 'dev', userId: 'u1', kind: 'photos', fileId: 'f1' })

		expect(key.startsWith(buildUserPrefix({ prefix: 'dev', userId: 'u1' }))).toBe(true)
		expect(key.startsWith(buildUserPrefix({ prefix: 'dev', userId: 'u10' }))).toBe(false)
	})
})

describe('buildUserPrefix', () => {
	it('ends with a slash so u1 does not match u10', () => {
		expect(buildUserPrefix({ prefix: 'dev', userId: 'u1' })).toBe('dev/users/u1/')
	})

	it('normalizes a trailing slash in the prefix', () => {
		expect(buildUserPrefix({ prefix: 'dev/', userId: 'u1' })).toBe('dev/users/u1/')
	})
})
