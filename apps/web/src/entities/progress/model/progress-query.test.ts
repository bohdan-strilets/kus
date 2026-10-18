import { describe, expect, it, vi } from 'vitest'

import { PROGRESS_QUERY_KEY, progressQueryOptions } from './progress-query'

vi.mock('../api/get-progress', () => ({ getProgress: vi.fn() }))

describe('progressQueryOptions', () => {
	it('puts the range and today into the key, under the progress prefix', () => {
		const { queryKey } = progressQueryOptions(30, '2026-10-12')

		expect(queryKey).toEqual([...PROGRESS_QUERY_KEY, 30, '2026-10-12'])
	})

	it('gives another key when today moves on, so midnight means a new request', () => {
		const yesterday = progressQueryOptions(7, '2026-10-12').queryKey
		const today = progressQueryOptions(7, '2026-10-13').queryKey

		expect(today).not.toEqual(yesterday)
	})

	it('gives another key per range on the same day', () => {
		expect(progressQueryOptions(7, '2026-10-12').queryKey).not.toEqual(
			progressQueryOptions(30, '2026-10-12').queryKey,
		)
	})

	it('stays under the day key, so invalidating days refreshes progress by prefix', () => {
		const { queryKey } = progressQueryOptions(7, '2026-10-12')

		expect(queryKey.slice(0, PROGRESS_QUERY_KEY.length)).toEqual([...PROGRESS_QUERY_KEY])
		expect(queryKey[0]).toBe('day')
	})
})
