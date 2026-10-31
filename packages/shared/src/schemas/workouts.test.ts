import { describe, expect, it } from 'vitest'

import { workoutResponseSchema } from './workouts.js'

const OLD_RESPONSE = {
	id: '0199b3a4-0000-7000-8000-0000000000f1',
	localDate: '2026-10-26',
	startedAt: '2026-10-26T17:30:00.000Z',
	durationMin: 55,
	place: 'GYM',
	kcalBurned: null,
	kcalSource: null,
	exercises: [
		{
			id: '0199b3a4-0000-7000-8000-0000000000e1',
			name: 'Підтягування',
			kind: 'STRENGTH',
			durationMin: null,
			distanceM: null,
			sets: [{ reps: 10, weightKg: null, durationSec: null, distanceM: null, isWarmup: false }],
			record: 'WEIGHT',
		},
	],
}

describe('workoutResponseSchema', () => {
	it('reads a response from before 0.10.0 with the new fields empty', () => {
		const workout = workoutResponseSchema.parse(OLD_RESPONSE)

		expect(workout).toMatchObject({ finishedAt: null, estimatedDurationMin: null })
		expect(workout.exercises[0]).toMatchObject({
			muscleGroup: null,
			performedAt: null,
			record: 'WEIGHT',
		})
	})

	it('reads REPS, and a record type it does not know as none', () => {
		const withRecord = (record: string) =>
			workoutResponseSchema.parse({
				...OLD_RESPONSE,
				exercises: [{ ...OLD_RESPONSE.exercises[0], record }],
			}).exercises[0]?.record

		expect(withRecord('REPS')).toBe('REPS')
		expect(withRecord('TIME')).toBeNull()
	})
})
