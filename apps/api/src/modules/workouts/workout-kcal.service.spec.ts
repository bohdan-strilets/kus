import { describe, expect, it, vi } from 'vitest'

import type { MeasurementsService } from '../measurements/measurements.service'
import { WorkoutKcalService } from './workout-kcal.service'
import type { WorkoutWithExercises } from './workouts.repository'

const USER = '0199b3a4-0000-7000-8000-0000000000a1'

const makeRow = (id: string, localDate: string): WorkoutWithExercises =>
	({
		id,
		userId: USER,
		localDate: new Date(`${localDate}T00:00:00Z`),
		startedAt: new Date(`${localDate}T17:30:00Z`),
		durationMin: 60,
		place: 'GYM',
		kcalBurned: null,
		kcalSource: null,
		note: null,
		records: null,
		editedAt: null,
		finishedAt: null,
		finishedMessageId: null,
		sourceMessageId: null,
		templateId: null,
		template: null,
		source: 'CHAT',
		createdAt: new Date(`${localDate}T17:30:00Z`),
		updatedAt: new Date(`${localDate}T17:30:00Z`),
		deletedAt: null,
		exercises: [
			{
				id: `e-${id}`,
				name: 'Жим лежачи',
				kind: 'STRENGTH',
				muscleGroup: null,
				position: 0,
				durationMin: null,
				distanceM: null,
				kcalBurned: null,
				source: 'MANUAL',
				performedAt: new Date(`${localDate}T17:30:00Z`),
				exerciseId: null,
				isBodyweight: null,
				exercise: null,
				sets: [],
			},
		],
	}) as unknown as WorkoutWithExercises

const build = (weights: { localDate: string; value: number }[]) => {
	const measurements = { findWeightsAround: vi.fn().mockResolvedValue(weights) }
	const service = new WorkoutKcalService(measurements as unknown as MeasurementsService)
	return { measurements, service }
}

describe('WorkoutKcalService.toResponses', () => {
	it('reads the weigh-ins once for many workouts, for the given user and the span of days', async () => {
		const { measurements, service } = build([{ localDate: '2026-10-20', value: 80 }])
		const rows = [
			makeRow('w3', '2026-10-28'),
			makeRow('w1', '2026-10-25'),
			makeRow('w2', '2026-10-27'),
		]

		const responses = await service.toResponses(USER, rows)

		expect(measurements.findWeightsAround).toHaveBeenCalledTimes(1)
		expect(measurements.findWeightsAround).toHaveBeenCalledWith({
			userId: USER,
			from: new Date('2026-10-25T00:00:00Z'),
			to: new Date('2026-10-28T00:00:00Z'),
		})
		expect(responses.map(({ id }) => id)).toEqual(['w3', 'w1', 'w2'])
		expect(responses.every(({ kcal }) => kcal?.value === 200)).toBe(true)
	})

	it('picks the weight per workout day', async () => {
		const { service } = build([
			{ localDate: '2026-10-20', value: 80 },
			{ localDate: '2026-10-27', value: 100 },
		])

		const [early, late] = await service.toResponses(USER, [
			makeRow('w1', '2026-10-25'),
			makeRow('w2', '2026-10-28'),
		])

		expect(early?.kcal?.value).toBe(200)
		expect(late?.kcal?.value).toBe(250)
	})

	it('has no estimate when there are no weigh-ins', async () => {
		const { service } = build([])
		const [response] = await service.toResponses(USER, [makeRow('w1', '2026-10-25')])
		expect(response?.kcal).toBeNull()
	})

	it('makes no query for an empty list', async () => {
		const { measurements, service } = build([])
		expect(await service.toResponses(USER, [])).toEqual([])
		expect(measurements.findWeightsAround).not.toHaveBeenCalled()
	})
})
