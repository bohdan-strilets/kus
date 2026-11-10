import type { Prisma } from '../../generated/prisma/client'
import { describe, expect, it, vi } from 'vitest'

import type { PrismaService } from '../../prisma'

import { type ExerciseRow, WorkoutsService } from './workouts.service'
import type { WorkoutKcalService } from './workout-kcal.service'
import type { WorkoutRecordsService } from './workout-records.service'
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
		{} as unknown as PrismaService,
		{} as unknown as WorkoutRecordsService,
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

describe('WorkoutsService.resolveExercise', () => {
	const barbell: ExerciseRow = {
		id: 'b',
		name: 'Жим лежачи',
		kind: 'STRENGTH',
		muscleGroup: 'CHEST',
		aliases: [],
	}
	const machine: ExerciseRow = { ...barbell, id: 'm', name: 'Жим від грудей' }

	const setup = (dictionary: ExerciseRow[], taken: ExerciseRow | null = null) => {
		const { repository, service } = build(taken)
		const extended = {
			...repository,
			findDictionary: vi.fn().mockResolvedValue(dictionary),
			addExerciseAlias: vi.fn().mockResolvedValue(true),
		}
		const withRepo = new WorkoutsService(
			extended as unknown as WorkoutsRepository,
			{} as unknown as WorkoutKcalService,
			{} as unknown as PrismaService,
			{} as unknown as WorkoutRecordsService,
		)
		return { repository: extended, service: withRepo, unused: service }
	}

	it('keeps the ref of the single row the longer name means and learns the name as an alias', async () => {
		const { repository, service } = setup([barbell, machine])

		const row = await service.resolveExercise(
			'u1',
			{ item: { name: 'Жим лежачи штангою', kind: 'STRENGTH' }, ref: barbell },
			tx,
		)

		expect(row.id).toBe('b')
		expect(repository.addExerciseAlias).toHaveBeenCalledWith(
			{ userId: 'u1', id: 'b', alias: 'жим лежачи штангою' },
			tx,
		)
	})

	it('does not glue «Жим від грудей» to «Жим лежачи»: the name decides, no alias', async () => {
		const { repository, service } = setup([barbell])

		const row = await service.resolveExercise(
			'u1',
			{ item: { name: 'Жим від грудей', kind: 'STRENGTH' }, ref: barbell },
			tx,
		)

		expect(row.id).toBe('new')
		expect(repository.createExercise).toHaveBeenCalledWith(
			expect.objectContaining({ nameNormalized: 'жим від грудей' }),
			tx,
		)
		expect(repository.addExerciseAlias).not.toHaveBeenCalled()
	})

	it('learns nothing when two rows fit the name', async () => {
		const { repository, service } = setup([barbell, { ...machine, name: 'Жим на лаві' }])

		const row = await service.resolveExercise(
			'u1',
			{ item: { name: 'Жим лежачи на лаві', kind: 'STRENGTH' }, ref: barbell },
			tx,
		)

		expect(row.id).toBe('b')
		expect(repository.addExerciseAlias).not.toHaveBeenCalled()
	})

	it('does not take a name that already belongs to another row as an alias', async () => {
		const { repository, service } = setup([barbell], machine)

		await service.resolveExercise(
			'u1',
			{ item: { name: 'Жим лежачи штангою', kind: 'STRENGTH' }, ref: barbell },
			tx,
		)

		expect(repository.addExerciseAlias).not.toHaveBeenCalled()
	})

	it('goes by the name when there is no live ref row', async () => {
		const { repository, service } = setup([])

		await service.resolveExercise(
			'u1',
			{ item: { name: 'Жим лежачи', kind: 'STRENGTH' }, ref: null },
			tx,
		)

		expect(repository.createExercise).toHaveBeenCalled()
		expect(repository.findDictionary).not.toHaveBeenCalled()
	})
})
