import { describe, expect, it } from 'vitest'

import {
	canBeSameExercise,
	isExerciseNamed,
	isSameExercise,
	judgeExerciseRef,
} from './exercise-names'

const bench = { name: 'Жим лежачи', aliases: ['bench press'] }

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

describe('isSameExercise', () => {
	it('accepts the name, a shorter or longer wording and an alias', () => {
		expect(isSameExercise('Жим лежачи', bench)).toBe(true)
		expect(isSameExercise('жим', bench)).toBe(true)
		expect(isSameExercise('Жим лежачи на лаві', bench)).toBe(true)
		expect(isSameExercise('Bench Press', bench)).toBe(true)
	})

	it('rejects a name with nothing in common, and an empty one', () => {
		expect(isSameExercise('Присідання', bench)).toBe(false)
		expect(isSameExercise('  ', bench)).toBe(false)
	})

	it('works for a row without aliases', () => {
		expect(isSameExercise('Присідання', { name: 'Жим лежачи' })).toBe(false)
	})
})

const row = (id: string, name: string, muscleGroup: 'CHEST' | 'SHOULDERS' | null = 'CHEST') => ({
	id,
	name,
	kind: 'STRENGTH' as const,
	muscleGroup,
	aliases: [] as string[],
})
const barbell = row('b', 'Жим лежачи')
const machine = row('m', 'Жим від грудей')
const given = (name: string) => ({ name, kind: 'STRENGTH' as const })

describe('canBeSameExercise', () => {
	it('keeps «Жим від грудей» and «Жим лежачи» two exercises', () => {
		expect(canBeSameExercise(given('Жим від грудей'), barbell)).toBe(false)
		expect(canBeSameExercise(given('Жим лежачи'), machine)).toBe(false)
	})

	it('accepts the same name, a wording with other endings and a longer one', () => {
		expect(canBeSameExercise(given('Жим лежачи'), barbell)).toBe(true)
		expect(canBeSameExercise(given('жимом лежачи'), barbell)).toBe(true)
		expect(canBeSameExercise(given('Жим лежачи штангою'), barbell)).toBe(true)
	})

	it('rejects another group, another kind and another movement', () => {
		expect(canBeSameExercise(given('Жим на плечі'), barbell)).toBe(false)
		expect(canBeSameExercise({ name: 'Жим', kind: 'CARDIO' }, barbell)).toBe(false)
		expect(canBeSameExercise(given('Присідання'), barbell)).toBe(false)
	})
})

describe('judgeExerciseRef', () => {
	it('is exact for the name or an alias, whatever the case', () => {
		expect(judgeExerciseRef(given('жим ЛЕЖАЧИ'), barbell, [barbell, machine])).toBe('exact')
		expect(
			judgeExerciseRef(given('bench'), { ...barbell, aliases: ['bench'] }, [barbell, machine]),
		).toBe('exact')
	})

	it('rejects the ref of «Жим лежачи» for «Жим від грудей» even when it is the only row', () => {
		expect(judgeExerciseRef(given('Жим від грудей'), barbell, [barbell])).toBe('reject')
	})

	it('learns an alias when the ref is the single row the longer name can mean', () => {
		expect(judgeExerciseRef(given('Жим лежачи штангою'), barbell, [barbell, machine])).toBe('alias')
	})

	it('keeps the ref but learns nothing when several rows fit the name', () => {
		expect(judgeExerciseRef(given('Жим'), barbell, [barbell, machine])).toBe('accept')
	})

	it('learns nothing from a shorter wording, even with one fitting row', () => {
		expect(judgeExerciseRef(given('Жим'), barbell, [barbell])).toBe('accept')
	})
})
