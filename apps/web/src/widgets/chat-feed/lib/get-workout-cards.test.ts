import { describe, expect, it } from 'vitest'

import { makeWorkout } from '@/shared/testing'

import { getWorkoutCards } from './get-workout-cards'

describe('getWorkoutCards', () => {
	it('follows the cards the backend decided, with the session of each', () => {
		const workout = makeWorkout()
		const cards = getWorkoutCards({
			workouts: [workout],
			workoutCards: [{ workoutId: workout.id, variant: 'EXERCISES', exerciseIds: ['e1'] }],
		})

		expect(cards).toEqual([{ workout, variant: 'EXERCISES', exerciseIds: ['e1'] }])
	})

	it('an old message with workouts but no cards is a summary', () => {
		const workout = makeWorkout()
		const [card] = getWorkoutCards({ workouts: [workout], workoutCards: [] })

		expect(card?.variant).toBe('SUMMARY')
		expect(card?.exerciseIds).toEqual(workout.exercises.map((exercise) => exercise.id))
	})

	it('drops a card whose workout the message does not carry', () => {
		expect(
			getWorkoutCards({
				workouts: [],
				workoutCards: [{ workoutId: 'gone', variant: 'SUMMARY', exerciseIds: [] }],
			}),
		).toEqual([])
	})
})
