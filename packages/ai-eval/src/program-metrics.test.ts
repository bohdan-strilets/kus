import type { ProgramContext } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import type { ExpectedProgram } from './cases/case.types.js'
import type { LoggedProgram, LoggedProgramTemplate } from './eval.types.js'
import { isProgramCorrect } from './program-metrics.js'

const exercise = (name: string, weightKg: number | null = null) => ({ name, weightKg })

const template = (overrides: Partial<LoggedProgramTemplate> = {}): LoggedProgramTemplate => ({
	ref: null,
	name: 'Тренування А',
	weekdays: [],
	exercises: [exercise('Жим лежачи'), exercise('Присідання'), exercise('Тяга')],
	...overrides,
})

const program = (overrides: Partial<LoggedProgram> = {}): LoggedProgram => ({
	mode: 'ROTATE',
	pinnedRef: null,
	templates: [template(), template({ name: 'Тренування Б' })],
	...overrides,
})

const CONTEXT: ProgramContext = {
	mode: 'ROTATE',
	perWeek: 2,
	title: null,
	nextRef: 't1',
	templates: [
		{ ref: 't1', name: 'Тренування А', weekdays: [], exercises: [] },
		{ ref: 't2', name: 'Тренування Б', weekdays: [], exercises: [] },
	],
}

const check = (expected: ExpectedProgram, actual: LoggedProgram | null, context = CONTEXT) =>
	isProgramCorrect(expected, actual, context)

describe('isProgramCorrect', () => {
	it('never matches without a proposal', () => {
		expect(check({}, null)).toBe(false)
		expect(check({}, program())).toBe(true)
	})

	it('takes one mode or any of several', () => {
		expect(check({ mode: 'ROTATE' }, program())).toBe(true)
		expect(check({ mode: 'SINGLE' }, program())).toBe(false)
		expect(check({ mode: ['ROTATE', 'WEEKDAYS'] }, program({ mode: 'WEEKDAYS' }))).toBe(true)
		expect(check({ mode: ['ROTATE', 'WEEKDAYS'] }, program({ mode: 'SINGLE' }))).toBe(false)
	})

	it('counts templates and the exercises of every template', () => {
		expect(check({ templateCount: { min: 2, max: 3 } }, program())).toBe(true)
		expect(check({ templateCount: { min: 3, max: 4 } }, program())).toBe(false)
		expect(check({ exerciseCount: { min: 3, max: 5 } }, program())).toBe(true)
		const thin = program({ templates: [template(), template({ exercises: [exercise('Планка')] })] })
		expect(check({ exerciseCount: { min: 3, max: 5 } }, thin)).toBe(false)
	})

	it('finds each expected template by name and judges its exercises', () => {
		const swapped = program({
			templates: [
				template(),
				template({ name: 'Тренування Б', exercises: [exercise('Присідання зі штангою')] }),
			],
		})
		const want: ExpectedProgram = {
			templates: [
				{ nameIncludes: 'тренування б', exercises: [{ nameIncludes: 'присід' }] },
				{ nameIncludes: 'тренування а', exerciseCount: { min: 3, max: 3 } },
			],
		}
		expect(check(want, swapped)).toBe(true)
		expect(
			check(
				{ templates: [{ nameIncludes: 'тренування б', exerciseCount: { min: 3, max: 3 } }] },
				swapped,
			),
		).toBe(false)
	})

	it('fails when an exercise that must be absent is there', () => {
		const want: ExpectedProgram = {
			templates: [{ exercises: [{ nameIncludes: 'жим лежачи', absent: true }] }],
		}
		expect(check(want, program())).toBe(false)
		expect(
			check(want, program({ templates: [template({ exercises: [exercise('Присідання')] })] })),
		).toBe(true)
	})

	it('matches one expected template to one answered template', () => {
		const want: ExpectedProgram = {
			templates: [{ nameIncludes: 'тренування' }, { nameIncludes: 'тренування' }],
		}
		expect(check(want, program())).toBe(true)
		expect(check(want, program({ templates: [template()] }))).toBe(false)
	})

	it('compares weekdays as a set', () => {
		const answer = program({ mode: 'WEEKDAYS', templates: [template({ weekdays: [4, 1] })] })
		expect(check({ templates: [{ weekdays: [1, 4] }] }, answer)).toBe(true)
		expect(check({ templates: [{ weekdays: [1, 5] }] }, answer)).toBe(false)
		expect(check({ templates: [{ weekdays: [1] }] }, answer)).toBe(false)
	})

	it('rejects any invented weight', () => {
		const heavy = program({ templates: [template({ exercises: [exercise('Жим', 40)] })] })
		expect(check({ noInventedWeights: true }, program())).toBe(true)
		expect(check({ noInventedWeights: true }, heavy)).toBe(false)
	})

	it('wants every template of the case program back under its ref', () => {
		const kept = program({
			templates: [template({ ref: 't1' }), template({ ref: 't2', name: 'Тренування Б' })],
		})
		expect(check({ keepsRefs: true }, kept)).toBe(true)
		expect(check({ keepsRefs: true }, program())).toBe(false)
		const dropped = program({ templates: [template({ ref: 't1' })] })
		expect(check({ keepsRefs: true }, dropped)).toBe(false)
	})

	it('checks the pin against the ref of the named template of the case program', () => {
		expect(check({ pinnedRefOf: 'Тренування А' }, program({ pinnedRef: 't1' }))).toBe(true)
		expect(check({ pinnedRefOf: 'Тренування А' }, program({ pinnedRef: 't2' }))).toBe(false)
		expect(check({ pinnedRefOf: 'Тренування А' }, program())).toBe(false)
		expect(check({ pinnedRefOf: 'Тренування В' }, program({ pinnedRef: 't1' }))).toBe(false)
	})
})
