import { describe, expect, it } from 'vitest'

import { isExerciseNamed, normalizeExerciseName } from './exercise-names'

const bench = { name: 'Жим лежачи', aliases: ['bench press'] }

describe('normalizeExerciseName', () => {
	it('ignores case, punctuation and spacing', () => {
		expect(normalizeExerciseName('  Жим   лежачи. ')).toBe('жим лежачи')
	})
})

describe('isExerciseNamed', () => {
	it('finds an exercise by one of its words, whatever the ending', () => {
		expect(isExerciseNamed('а жим сьогодні був добрий?', bench)).toBe(true)
		expect(isExerciseNamed('зробив жимом 80', bench)).toBe(true)
	})

	it('finds it by an alias', () => {
		expect(isExerciseNamed('bench 80 3x8', bench)).toBe(true)
	})

	it('does not find an exercise the message does not name', () => {
		expect(isExerciseNamed('що поїсти на вечерю', bench)).toBe(false)
		expect(isExerciseNamed('', bench)).toBe(false)
	})

	it('ignores words shorter than three letters in the name', () => {
		expect(isExerciseNamed('на вулиці', { name: 'Біг на місці', aliases: [] })).toBe(false)
	})
})
