import { describe, expect, it, vi } from 'vitest'

import type { PrismaService } from '../../prisma'
import { WorkoutStatsRepository } from './workout-stats.repository'

describe('WorkoutStatsRepository.findFirstWorkoutDate', () => {
	const localDate = new Date('2026-10-19T00:00:00Z')

	it('takes the earliest day of the live workouts of the user only', async () => {
		const aggregate = vi.fn().mockResolvedValue({ _min: { localDate } })
		const repository = new WorkoutStatsRepository({
			workout: { aggregate },
		} as unknown as PrismaService)

		await expect(repository.findFirstWorkoutDate({ userId: 'user-1' })).resolves.toEqual(localDate)

		expect(aggregate).toHaveBeenCalledWith({
			where: { userId: 'user-1', deletedAt: null, NOT: { source: 'LIVE', finishedAt: null } },
			_min: { localDate: true },
		})
	})

	it('is null without workouts', async () => {
		const aggregate = vi.fn().mockResolvedValue({ _min: { localDate: null } })
		const repository = new WorkoutStatsRepository({
			workout: { aggregate },
		} as unknown as PrismaService)

		await expect(repository.findFirstWorkoutDate({ userId: 'user-1' })).resolves.toBeNull()
	})
})
