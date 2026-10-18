import { describe, expect, it, vi } from 'vitest'

import { makeProgress } from '@/shared/testing'

import { getProgress } from './get-progress'

const mockGet = vi.hoisted(() => vi.fn())

vi.mock('@/shared/api', () => ({ httpClient: { get: mockGet } }))

describe('getProgress', () => {
	// the web may be deployed before the API: a missing start is «no start», not a parse error
	it('reads an answer of an older API without the start fields: no start, nothing to compare', async () => {
		const progress = makeProgress()
		const { weight } = progress
		if (!weight) throw new Error('the fixture has a weight')
		const { start: _start, fromStart: _fromStart, ...oldWeight } = weight
		mockGet.mockResolvedValue({ data: { data: { ...progress, weight: oldWeight } } })

		const result = await getProgress(30)

		expect(result.weight?.start).toBeNull()
		expect(result.weight?.fromStart).toBeNull()
		expect(result.weight?.current.value).toBe(82.4)
	})
})
