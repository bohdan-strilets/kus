import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { DAY_QUERY_KEY } from '@/entities/day'

import { invalidateGoalQueries } from './invalidate-goal-queries'

describe('invalidateGoalQueries', () => {
	it('refreshes every day and the profile with the goals preview', async () => {
		const client = new QueryClient()
		const invalidate = vi.spyOn(client, 'invalidateQueries')

		await invalidateGoalQueries(client)

		expect(invalidate).toHaveBeenCalledWith({ queryKey: DAY_QUERY_KEY })
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ['profile'] })
		expect(invalidate).toHaveBeenCalledTimes(2)
	})
})
