import { describe, expect, it } from 'vitest'

import { groupIdsByMuscleGroup, planMuscleGroupBackfill } from './muscle-group-backfill'

describe('planMuscleGroupBackfill', () => {
	it('keeps a group already set, takes the dictionary for the rest and lists unknown names once', () => {
		const plan = planMuscleGroupBackfill([
			{ id: 'a', name: 'жим ногами', muscleGroup: 'CHEST' },
			{ id: 'b', name: 'Жим лежачи', muscleGroup: null },
			{ id: 'c', name: 'присідання', muscleGroup: null },
			{ id: 'd', name: 'Зарядка', muscleGroup: null },
			{ id: 'e', name: 'Зарядка', muscleGroup: null },
			{ id: 'f', name: 'жим сидячи', muscleGroup: null },
		])

		expect(plan.withGroup).toBe(1)
		expect(plan.fromDictionary).toEqual([
			{ id: 'b', muscleGroup: 'CHEST' },
			{ id: 'c', muscleGroup: 'LEGS' },
		])
		expect(plan.unmatchedNames).toEqual(['жим сидячи', 'Зарядка'])
	})

	it('has nothing to do for an empty dictionary', () => {
		expect(planMuscleGroupBackfill([])).toEqual({
			withGroup: 0,
			fromDictionary: [],
			unmatchedNames: [],
		})
	})
})

describe('groupIdsByMuscleGroup', () => {
	it('collects the ids of each group', () => {
		const byGroup = groupIdsByMuscleGroup([
			{ id: 'b', muscleGroup: 'CHEST' },
			{ id: 'c', muscleGroup: 'LEGS' },
			{ id: 'g', muscleGroup: 'CHEST' },
		])

		expect([...byGroup]).toEqual([
			['CHEST', ['b', 'g']],
			['LEGS', ['c']],
		])
	})
})
