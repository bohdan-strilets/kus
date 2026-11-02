import type { Prisma } from '../../generated/prisma/client'
import { describe, expect, it, vi } from 'vitest'

import { type ExerciseRow, WorkoutsService } from './workouts.service'
import type { WorkoutKcalService } from './workout-kcal.service'
import type { WorkoutsRepository } from './workouts.repository'

const tx = {} as Prisma.TransactionClient

const createRepository = (known: ExerciseRow | null) => {
	const created: ExerciseRow = { id: 'new', name: 'Тяга', kind: 'STRENGTH', muscleGroup: 'BACK' }
	return {
		findExerciseByName: vi.fn().mockResolvedValue(known),
		createExercise: vi.fn().mockResolvedValue(created),
		fillExerciseMuscleGroup: vi.fn().mockResolvedValue(undefined),
		findExercisesByIds: vi.fn().mockResolvedValue([]),
	}
}

const build = (known: ExerciseRow | null) => {
	const repository = createRepository(known)
	const service = new WorkoutsService(
		repository as unknown as WorkoutsRepository,
		{} as unknown as WorkoutKcalService,
	)
	return { repository, service }
}

describe('WorkoutsService.findOrCreateExercise', () => {
	it('creates a new row with the caller group', async () => {
		const { repository, service } = build(null)

		await service.findOrCreateExercise(
			'u1',
			{ name: 'Тяга', kind: 'STRENGTH', muscleGroup: 'BACK' },
			tx,
		)

		expect(repository.createExercise).toHaveBeenCalledWith(
			expect.objectContaining({ muscleGroup: 'BACK' }),
			tx,
		)
	})

	it('creates without a group when the caller sets none (the chat) and for cardio', async () => {
		const { repository, service } = build(null)

		await service.findOrCreateExercise('u1', { name: 'Тяга', kind: 'STRENGTH' }, tx)
		await service.findOrCreateExercise(
			'u1',
			{ name: 'Біг', kind: 'CARDIO', muscleGroup: 'LEGS' },
			tx,
		)

		expect(repository.createExercise).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ muscleGroup: null }),
			tx,
		)
		expect(repository.createExercise).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ muscleGroup: null }),
			tx,
		)
	})

	it('fills a group-less existing row but never overwrites a set group', async () => {
		const bare = build({ id: 'e1', name: 'Тяга', kind: 'STRENGTH', muscleGroup: null })
		const filled = await bare.service.findOrCreateExercise(
			'u1',
			{ name: 'Тяга', kind: 'STRENGTH', muscleGroup: 'BACK' },
			tx,
		)
		expect(filled.muscleGroup).toBe('BACK')
		expect(bare.repository.fillExerciseMuscleGroup).toHaveBeenCalledWith(
			{ userId: 'u1', id: 'e1', muscleGroup: 'BACK' },
			tx,
		)

		const set = build({ id: 'e2', name: 'Тяга', kind: 'STRENGTH', muscleGroup: 'ARMS' })
		const kept = await set.service.findOrCreateExercise(
			'u1',
			{ name: 'Тяга', kind: 'STRENGTH', muscleGroup: 'BACK' },
			tx,
		)
		expect(kept.muscleGroup).toBe('ARMS')
		expect(set.repository.fillExerciseMuscleGroup).not.toHaveBeenCalled()
	})
})
