import { describe, expect, it } from 'vitest'

import type {
	ProgramDraft,
	ProgramTemplateDraft,
	TemplateExerciseDraft,
} from '../schemas/programs.js'
import { diffPrograms } from './program-diff.js'

const KEY_A = '00000000-0000-4000-8000-00000000000a'
const KEY_B = '00000000-0000-4000-8000-00000000000b'
const KEY_C = '00000000-0000-4000-8000-00000000000c'
const EXERCISE_ID_1 = '00000000-0000-4000-8000-000000000101'
const EXERCISE_ID_2 = '00000000-0000-4000-8000-000000000102'

const target: TemplateExerciseDraft['target'] = {
	sets: 3,
	repsMin: 8,
	repsMax: 10,
	weightKg: 60,
	progressStepKg: 2.5,
	restSec: 90,
	durationMin: null,
	distanceM: null,
}

const exercise = (
	name: string,
	overrides: Partial<typeof target> = {},
	exerciseId: string | null = null,
): TemplateExerciseDraft => ({
	name,
	exerciseId,
	kind: 'STRENGTH',
	muscleGroup: null,
	target: { ...target, ...overrides },
})

const template = (
	key: string,
	name: string,
	exercises: TemplateExerciseDraft[],
	weekdays: number[] = [],
): ProgramTemplateDraft => ({ key, name, weekdays, exercises, estimatedMin: 55 })

const program = (
	templates: ProgramTemplateDraft[],
	overrides: Partial<Omit<ProgramDraft, 'templates'>> = {},
): ProgramDraft => ({ title: null, mode: 'ROTATE', perWeek: null, templates, ...overrides })

const single = (exercises: TemplateExerciseDraft[]): ProgramDraft =>
	program([template(KEY_A, 'День А', exercises)])

const describeLines = (base: ProgramDraft | null, next: ProgramDraft): string[] =>
	diffPrograms(base, next).lines.map(
		(l) => `${l.op}:${l.scope}:${l.templateName ?? ''}:${l.name ?? ''}:${l.field ?? ''}`,
	)

describe('diffPrograms — program level', () => {
	it('marks the first version as initial with no lines', () => {
		expect(diffPrograms(null, single([exercise('Жим')]))).toEqual({
			v: 1,
			initial: true,
			lines: [],
			unchangedTemplates: 0,
		})
	})

	it('returns no lines and counts every template for identical programs', () => {
		const base = program([
			template(KEY_A, 'День А', [exercise('Жим')]),
			template(KEY_B, 'День Б', [exercise('Тяга')]),
		])
		expect(diffPrograms(base, structuredClone(base))).toEqual({
			v: 1,
			initial: false,
			lines: [],
			unchangedTemplates: 2,
		})
	})

	it('reports mode, perWeek and title as PROGRAM lines in a fixed order', () => {
		const base = single([exercise('Жим')])
		const next = { ...base, title: 'Сила', mode: 'WEEKDAYS' as const, perWeek: 3 }
		expect(diffPrograms(base, next).lines).toEqual([
			expect.objectContaining({
				op: 'CHANGE',
				scope: 'PROGRAM',
				field: 'mode',
				before: 'ROTATE',
				after: 'WEEKDAYS',
			}),
			expect.objectContaining({ scope: 'PROGRAM', field: 'perWeek', before: null, after: 3 }),
			expect.objectContaining({ scope: 'PROGRAM', field: 'title', before: null, after: 'Сила' }),
		])
	})

	it('puts PROGRAM lines before template lines', () => {
		const base = single([exercise('Жим')])
		const next = { ...single([exercise('Жим', { sets: 4 })]), title: 'Сила' }
		expect(describeLines(base, next)).toEqual([
			'CHANGE:PROGRAM:::title',
			'CHANGE:EXERCISE:День А:Жим:target',
		])
	})
})

describe('diffPrograms — templates', () => {
	it('matches a renamed template by key and reports a name CHANGE', () => {
		const base = program([template(KEY_A, 'День А', [exercise('Жим')])])
		const next = program([template(KEY_A, 'Верх', [exercise('Жим')])])
		const result = diffPrograms(base, next)
		expect(result.lines).toEqual([
			expect.objectContaining({
				op: 'CHANGE',
				scope: 'TEMPLATE',
				templateName: 'Верх',
				field: 'name',
				before: 'День А',
				after: 'Верх',
			}),
		])
		expect(result.unchangedTemplates).toBe(0)
	})

	it('falls back to the normalized name when the key differs', () => {
		const base = program([template(KEY_A, 'День А', [exercise('Жим')])])
		const next = program([template(KEY_B, 'день а', [exercise('Жим')])])
		// paired (not ADD + REMOVE), so only the name differs
		expect(describeLines(base, next)).toEqual(['CHANGE:TEMPLATE:день а::name'])
	})

	it('reports a weekdays change with before/after', () => {
		const base = program([template(KEY_A, 'День А', [], [1, 3])])
		const next = program([template(KEY_A, 'День А', [], [1, 4])])
		expect(diffPrograms(base, next).lines).toEqual([
			expect.objectContaining({
				scope: 'TEMPLATE',
				field: 'weekdays',
				before: [1, 3],
				after: [1, 4],
			}),
		])
	})

	it('ignores the order of the same weekdays', () => {
		const base = program([template(KEY_A, 'День А', [], [1, 3, 5])])
		const next = program([template(KEY_A, 'День А', [], [5, 1, 3])])
		expect(diffPrograms(base, next)).toMatchObject({ lines: [], unchangedTemplates: 1 })
	})

	it('reports a whole added template as a single TEMPLATE line', () => {
		const base = program([template(KEY_A, 'День А', [exercise('Жим')])])
		const next = program([
			template(KEY_A, 'День А', [exercise('Жим')]),
			template(KEY_B, 'День Б', [exercise('Тяга'), exercise('Присідання')]),
		])
		expect(describeLines(base, next)).toEqual(['ADD:TEMPLATE:День Б:День Б:'])
		expect(diffPrograms(base, next).unchangedTemplates).toBe(1)
	})

	it('reports a whole removed template as a single TEMPLATE line', () => {
		const base = program([
			template(KEY_A, 'День А', [exercise('Жим')]),
			template(KEY_B, 'День Б', [exercise('Тяга'), exercise('Присідання')]),
		])
		const next = program([template(KEY_A, 'День А', [exercise('Жим')])])
		expect(describeLines(base, next)).toEqual(['REMOVE:TEMPLATE:День Б:День Б:'])
	})

	it('is deterministic: next order first, removed templates last', () => {
		const base = program([
			template(KEY_A, 'А', [exercise('Жим')]),
			template(KEY_B, 'Б', [exercise('Жим')]),
		])
		const next = program([
			template(KEY_C, 'В', [exercise('Жим')]),
			template(KEY_A, 'А', [exercise('Жим', { sets: 4 })]),
		])
		const expected = ['ADD:TEMPLATE:В:В:', 'CHANGE:EXERCISE:А:Жим:target', 'REMOVE:TEMPLATE:Б:Б:']
		expect(describeLines(base, next)).toEqual(expected)
		expect(describeLines(base, next)).toEqual(expected)
	})
})

describe('diffPrograms — exercises', () => {
	it('reports a target change as one CHANGE with before and after', () => {
		const base = single([exercise('Жим')])
		const next = single([exercise('Жим', { sets: 4 })])
		expect(diffPrograms(base, next).lines).toEqual([
			expect.objectContaining({
				op: 'CHANGE',
				scope: 'EXERCISE',
				templateName: 'День А',
				name: 'Жим',
				field: 'target',
				before: { ...target, sets: 3 },
				after: { ...target, sets: 4 },
			}),
		])
	})

	it('detects a change from a value to null', () => {
		const base = single([exercise('Жим')])
		const next = single([exercise('Жим', { weightKg: null })])
		expect(diffPrograms(base, next).lines).toHaveLength(1)
	})

	it('matches by normalized name: case, punctuation and spacing', () => {
		const base = single([exercise('Жим  Лежачи.')])
		const next = single([exercise('жим лежачи')])
		expect(diffPrograms(base, next)).toMatchObject({ lines: [], unchangedTemplates: 1 })
	})

	it('matches by exerciseId first, even when the name was changed', () => {
		const base = single([exercise('Жим', {}, EXERCISE_ID_1)])
		const next = single([exercise('Жим лежачи', {}, EXERCISE_ID_1)])
		expect(diffPrograms(base, next).lines).toEqual([])
	})

	it('does not pair different exercises with null exerciseId', () => {
		const base = single([exercise('Жим')])
		const next = single([exercise('Присідання')])
		expect(describeLines(base, next)).toEqual([
			'ADD:EXERCISE:День А:Присідання:',
			'REMOVE:EXERCISE:День А:Жим:',
		])
	})

	it('does not pair different exerciseIds', () => {
		const base = single([exercise('Жим ногами', {}, EXERCISE_ID_1)])
		const next = single([exercise('Присідання', {}, EXERCISE_ID_2)])
		expect(describeLines(base, next)).toEqual([
			'ADD:EXERCISE:День А:Присідання:',
			'REMOVE:EXERCISE:День А:Жим ногами:',
		])
	})

	it('reports a swap as ADD + REMOVE, never CHANGE', () => {
		const base = single([exercise('Жим ногами'), exercise('Тяга')])
		const next = single([exercise('Присідання'), exercise('Тяга')])
		expect(diffPrograms(base, next).lines.map((l) => l.op)).toEqual(['ADD', 'REMOVE'])
	})

	it('reports a pure reorder as one REORDER line per template', () => {
		const base = program([
			template(KEY_A, 'А', [exercise('Жим'), exercise('Тяга'), exercise('Присідання')]),
			template(KEY_B, 'Б', [exercise('Жим'), exercise('Тяга')]),
		])
		const next = program([
			template(KEY_A, 'А', [exercise('Присідання'), exercise('Жим'), exercise('Тяга')]),
			template(KEY_B, 'Б', [exercise('Тяга'), exercise('Жим')]),
		])
		expect(describeLines(base, next)).toEqual(['REORDER:TEMPLATE:А::', 'REORDER:TEMPLATE:Б::'])
	})

	it('does not report REORDER when an exercise is only added', () => {
		const base = single([exercise('Жим'), exercise('Тяга')])
		const next = single([exercise('Жим'), exercise('Присідання'), exercise('Тяга')])
		expect(describeLines(base, next)).toEqual(['ADD:EXERCISE:День А:Присідання:'])
	})

	it('pairs duplicates of the same exercise in order', () => {
		const base = single([exercise('Жим', { sets: 3 }), exercise('Жим', { sets: 4 })])
		const next = single([exercise('Жим', { sets: 3 }), exercise('Жим', { sets: 5 })])
		expect(diffPrograms(base, next).lines).toEqual([
			expect.objectContaining({
				op: 'CHANGE',
				before: { ...target, sets: 4 },
				after: { ...target, sets: 5 },
			}),
		])
	})

	it('removes the extra duplicate when a duplicate is dropped', () => {
		const base = single([exercise('Жим'), exercise('Жим')])
		const next = single([exercise('Жим')])
		expect(describeLines(base, next)).toEqual(['REMOVE:EXERCISE:День А:Жим:'])
	})

	it('handles an empty template on both sides', () => {
		expect(diffPrograms(single([]), single([]))).toMatchObject({ lines: [], unchangedTemplates: 1 })
	})
})
