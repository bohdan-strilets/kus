import type {
	ProgramChangeLine,
	ProgramChanges,
	ProgramDraft,
	TemplateExerciseTarget,
} from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import {
	formatProgramChangeLine,
	getProgramChangeGroups,
	getTemplateShortLabel,
	type ProgramChangeRow,
} from './format-program-changes'

const t = i18n.t.bind(i18n)

const target = (patch: Partial<TemplateExerciseTarget> = {}): TemplateExerciseTarget => ({
	sets: null,
	repsMin: null,
	repsMax: null,
	weightKg: null,
	progressStepKg: null,
	restSec: null,
	durationMin: null,
	distanceM: null,
	...patch,
})

const KEY = '0199b3a4-0000-7000-8000-000000000001'

const program: ProgramDraft = {
	title: null,
	mode: 'ROTATE',
	perWeek: 3,
	pinnedKey: null,
	templates: [
		{
			key: KEY,
			name: 'Тренування Б',
			weekdays: [],
			estimatedMin: 55,
			exercises: [
				{
					name: 'Присідання',
					exerciseId: null,
					kind: 'STRENGTH',
					muscleGroup: 'LEGS',
					target: target({
						sets: 3,
						repsMin: 8,
						repsMax: 12,
						weightKg: 70,
						progressStepKg: 2.5,
						restSec: 120,
					}),
				},
			],
		},
	],
}

const line = (patch: Partial<ProgramChangeLine>): ProgramChangeLine => ({
	op: 'CHANGE',
	scope: 'EXERCISE',
	templateName: 'Тренування Б',
	name: null,
	field: null,
	before: null,
	after: null,
	...patch,
})

const changes = (lines: ProgramChangeLine[]): ProgramChanges => ({
	v: 1,
	initial: false,
	lines,
	unchangedTemplates: 0,
})

describe('getProgramChangeGroups', () => {
	it('groups by template and tells added, removed and changed exercises', () => {
		const groups = getProgramChangeGroups(
			changes([
				line({
					op: 'REMOVE',
					name: 'Жим ногами',
					before: target({ sets: 3, repsMin: 10, repsMax: 12, weightKg: 120 }),
				}),
				line({ op: 'ADD', name: 'Присідання' }),
				line({
					field: 'target',
					name: 'Махи гантелями',
					before: target({ sets: 3, repsMin: 12, repsMax: 15 }),
					after: target({ sets: 4, repsMin: 12, repsMax: 15 }),
				}),
			]),
			program,
			t,
		)

		expect(groups).toHaveLength(1)
		expect(groups[0]?.label).toBe('Тренування Б')
		expect(groups[0]?.rows).toEqual([
			{
				key: '0',
				kind: 'removed',
				title: 'Жим ногами',
				detail: '3 підходи · 10–12 повт. · 120 кг',
			},
			{
				key: '1',
				kind: 'added',
				title: 'Присідання',
				detail: '3 підходи · 8–12 повт. · 70 кг · +2,5 кг · 120 с',
			},
			{
				key: '2',
				kind: 'changed',
				title: 'Махи гантелями',
				detail: 'було 3 підходи · 12–15 повт. · стало 4 підходи · 12–15 повт.',
				after: '4 підходи замість 3',
			},
		])
	})

	const afterOfChange = (before: TemplateExerciseTarget, after: TemplateExerciseTarget) =>
		getProgramChangeGroups(
			changes([line({ field: 'target', name: 'Махи', before, after })]),
			program,
			t,
		)[0]?.rows[0]?.after

	it.each([
		[1, '1 підхід замість 3'],
		[2, '2 підходи замість 3'],
		[5, '5 підходів замість 3'],
	])('tells only a changed number of sets short: %i sets', (sets, expected) => {
		expect(
			afterOfChange(
				target({ sets: 3, repsMin: 12, repsMax: 15 }),
				target({ sets, repsMin: 12, repsMax: 15 }),
			),
		).toBe(expected)
	})

	it('keeps the full new target when reps change with the sets', () => {
		expect(
			afterOfChange(
				target({ sets: 3, repsMin: 12, repsMax: 15 }),
				target({ sets: 4, repsMin: 8, repsMax: 10 }),
			),
		).toBe('4 підходи · 8–10 повт.')
	})

	it('keeps the full new target when the weight changes with the sets', () => {
		expect(
			afterOfChange(
				target({ sets: 3, repsMin: 8, repsMax: 10, weightKg: 50 }),
				target({ sets: 4, repsMin: 8, repsMax: 10, weightKg: 55 }),
			),
		).toBe('4 підходи · 8–10 повт. · 55 кг')
	})

	it('does not say «замість» when only the weight changes', () => {
		expect(
			afterOfChange(
				target({ sets: 3, repsMin: 8, repsMax: 10, weightKg: 50 }),
				target({ sets: 3, repsMin: 8, repsMax: 10, weightKg: 55 }),
			),
		).toBe('3 підходи · 8–10 повт. · 55 кг')
	})

	it('does not say «замість» when there were no sets before', () => {
		expect(afterOfChange(target({ repsMin: 8, repsMax: 10 }), target({ sets: 3 }))).not.toContain(
			'замість',
		)
	})

	it('does not say «замість» for an added or a removed exercise', () => {
		const rows = getProgramChangeGroups(
			changes([
				line({ op: 'ADD', name: 'Присідання' }),
				line({ op: 'REMOVE', name: 'Жим ногами', before: target({ sets: 3, repsMin: 10 }) }),
			]),
			program,
			t,
		)[0]?.rows
		expect(JSON.stringify(rows)).not.toContain('замість')
	})

	it('shows no detail for a removed exercise of a version saved without its target', () => {
		const groups = getProgramChangeGroups(
			changes([line({ op: 'REMOVE', name: 'Жим ногами' })]),
			program,
			t,
		)
		expect(groups[0]?.rows).toEqual([
			{ key: '0', kind: 'removed', title: 'Жим ногами', detail: null },
		])
	})

	it('puts the lines of the whole program first, with the mode in words', () => {
		const groups = getProgramChangeGroups(
			changes([
				line({ op: 'REMOVE', name: 'Жим ногами' }),
				line({
					scope: 'PROGRAM',
					templateName: null,
					field: 'mode',
					before: 'ROTATE',
					after: 'SINGLE',
				}),
				line({ scope: 'PROGRAM', templateName: null, field: 'perWeek', before: null, after: 4 }),
			]),
			program,
			t,
		)

		expect(groups.map((group) => group.label)).toEqual(['Тренування Б', 'Програма'])
		expect(groups[1]?.rows.map((row) => [row.title, row.detail])).toEqual([
			['Режим', 'було По черзі · стало Завжди одне'],
			['Разів на тиждень', 'було — · стало 4'],
		])
	})

	it('names weekdays, reorder and a new template', () => {
		const groups = getProgramChangeGroups(
			changes([
				line({ scope: 'TEMPLATE', field: 'weekdays', before: [1, 3], after: [2, 4] }),
				line({ scope: 'TEMPLATE', op: 'REORDER' }),
				line({ scope: 'TEMPLATE', op: 'ADD', name: 'Тренування Б' }),
			]),
			program,
			t,
		)

		expect(groups[0]?.rows).toEqual([
			{ key: '0', kind: 'changed', title: 'Дні тижня', detail: 'було Пн, Ср · стало Вт, Чт' },
			{ key: '1', kind: 'changed', title: 'Порядок змінено', detail: null, order: ['Присідання'] },
			{ key: '2', kind: 'added', title: 'Тренування Б', detail: null },
			{
				key: '2-0',
				kind: 'added',
				title: 'Присідання',
				detail: '3 підходи · 8–12 повт. · 70 кг',
				isNested: true,
			},
		])
	})

	describe('a stored card of two templates', () => {
		const exercise = (name: string, patch: Partial<TemplateExerciseTarget> = {}) => ({
			name,
			exerciseId: null,
			kind: 'STRENGTH' as const,
			muscleGroup: 'LEGS' as const,
			target: target({ sets: 3, repsMin: 8, repsMax: 12, weightKg: 60, ...patch }),
		})
		const twoTemplates: ProgramDraft = {
			...program,
			templates: [
				{
					key: KEY,
					name: 'Тренування А',
					weekdays: [],
					estimatedMin: 50,
					exercises: [exercise('Жим лежачи'), exercise('Тяга блока'), exercise('Присідання')],
				},
				{
					key: '0199b3a4-0000-7000-8000-000000000002',
					name: 'Тренування Б',
					weekdays: [],
					estimatedMin: 55,
					exercises: [exercise('Станова тяга'), exercise('Випади', { weightKg: 20 })],
				},
			],
		}
		const inA = (patch: Partial<ProgramChangeLine>) =>
			line({ templateName: 'Тренування А', ...patch })

		it('puts the added exercise right under the one it replaces', () => {
			const groups = getProgramChangeGroups(
				changes([
					inA({ op: 'REMOVE', name: 'Жим ногами', before: target({ sets: 3, repsMin: 10 }) }),
					inA({ op: 'REMOVE', name: 'Розведення', before: target({ sets: 3, repsMin: 12 }) }),
					inA({ op: 'ADD', name: 'Жим лежачи' }),
					inA({ op: 'ADD', name: 'Тяга блока' }),
					inA({ op: 'ADD', name: 'Присідання' }),
				]),
				twoTemplates,
				t,
			)

			expect(groups[0]?.rows.map((row) => `${row.kind}:${row.title}`)).toEqual([
				'removed:Жим ногами',
				'added:Жим лежачи',
				'removed:Розведення',
				'added:Тяга блока',
				'added:Присідання',
			])
		})

		it('pairs a replacement only inside its own template', () => {
			const groups = getProgramChangeGroups(
				changes([inA({ op: 'REMOVE', name: 'Жим ногами' }), line({ op: 'ADD', name: 'Випади' })]),
				twoTemplates,
				t,
			)

			expect(groups.map((group) => group.rows.map((row) => row.title))).toEqual([
				['Жим ногами'],
				['Випади'],
			])
		})

		it('shows a new template with its exercises as «+» rows', () => {
			const groups = getProgramChangeGroups(
				changes([
					line({
						scope: 'TEMPLATE',
						op: 'ADD',
						templateName: 'Тренування Б',
						name: 'Тренування Б',
					}),
				]),
				twoTemplates,
				t,
			)

			expect(groups[0]?.rows.map((row) => [row.kind, row.title, row.detail, row.isNested])).toEqual(
				[
					['added', 'Тренування Б', null, undefined],
					['added', 'Станова тяга', '3 підходи · 8–12 повт. · 60 кг', true],
					['added', 'Випади', '3 підходи · 8–12 повт. · 20 кг', true],
				],
			)
		})

		it('tells a new template of a version whose draft is gone without exercises', () => {
			const groups = getProgramChangeGroups(
				changes([line({ scope: 'TEMPLATE', op: 'ADD', templateName: 'Верх', name: 'Верх' })]),
				twoTemplates,
				t,
			)
			expect(groups[0]?.rows).toHaveLength(1)
		})

		it('lists the new order of the exercises of a reordered template', () => {
			const groups = getProgramChangeGroups(
				changes([line({ scope: 'TEMPLATE', op: 'REORDER', templateName: 'Тренування А' })]),
				twoTemplates,
				t,
			)

			expect(groups[0]?.rows).toEqual([
				{
					key: '0',
					kind: 'changed',
					title: 'Порядок змінено',
					detail: null,
					order: ['Жим лежачи', 'Тяга блока', 'Присідання'],
				},
			])
		})

		it('lists the new order of the templates when the line has no template', () => {
			const groups = getProgramChangeGroups(
				changes([line({ scope: 'PROGRAM', op: 'REORDER', templateName: null })]),
				twoTemplates,
				t,
			)
			expect(groups[0]?.rows[0]?.order).toEqual(['Тренування А', 'Тренування Б'])
		})

		it('hides a change whose shown plan is the same and drops its template', () => {
			const hidden = {
				field: 'target' as const,
				before: target({ sets: 3, repsMin: 8, repsMax: 12, weightKg: 60, restSec: 90 }),
				after: target({ sets: 3, repsMin: 8, repsMax: 12, weightKg: 60, restSec: 120 }),
			}
			const groups = getProgramChangeGroups(
				changes([
					inA({ name: 'Жим лежачи', ...hidden }),
					line({
						name: 'Випади',
						field: 'target',
						before: target({ sets: 3, repsMin: 8, repsMax: 12, weightKg: 20 }),
						after: target({ sets: 4, repsMin: 8, repsMax: 12, weightKg: 20 }),
					}),
				]),
				twoTemplates,
				t,
			)

			expect(groups.map((group) => group.label)).toEqual(['Тренування Б'])
			expect(groups[0]?.rows.map((row) => row.title)).toEqual(['Випади'])
		})

		it('has no groups when every change is invisible', () => {
			const groups = getProgramChangeGroups(
				changes([
					inA({
						name: 'Жим лежачи',
						field: 'target',
						before: target({ sets: 3, restSec: 90, progressStepKg: 2.5 }),
						after: target({ sets: 3, restSec: 120, progressStepKg: 5 }),
					}),
				]),
				twoTemplates,
				t,
			)
			expect(groups).toEqual([])
		})
	})

	it('has no groups when nothing changed', () => {
		expect(getProgramChangeGroups(changes([]), program, t)).toEqual([])
	})
})

describe('getTemplateShortLabel', () => {
	it('cuts «Тренування » off a lettered template, keeps any other name', () => {
		expect(getTemplateShortLabel('Тренування Б')).toBe('Б')
		expect(getTemplateShortLabel('Верх тіла')).toBe('Верх тіла')
		expect(getTemplateShortLabel('Тренування ')).toBe('Тренування ')
	})
})

describe('formatProgramChangeLine', () => {
	const row = (patch: Partial<ProgramChangeRow>): ProgramChangeRow => ({
		key: '0',
		kind: 'added',
		title: 'Махи',
		detail: null,
		...patch,
	})

	it('tells a change by its new target after a dash', () => {
		expect(
			formatProgramChangeLine(
				row({
					kind: 'changed',
					detail: 'було 3 підходи · 12–15 повт. · стало 4 підходи · 12–15 повт.',
					after: '4 підходи · 12–15 повт.',
				}),
				'Тренування Б',
			),
		).toBe('Б: Махи — 4 підходи · 12–15 повт.')
	})

	it('tells an added exercise with its target, no dash', () => {
		expect(
			formatProgramChangeLine(
				row({ title: 'Присідання', detail: '3 підходи · 8–12 повт. · 70 кг' }),
				'Тренування Б',
			),
		).toBe('Б: Присідання · 3 підходи · 8–12 повт. · 70 кг')
		expect(formatProgramChangeLine(row({}), 'Тренування Б')).toBe('Б: Махи')
	})

	it('leaves only the name of a removed one', () => {
		expect(
			formatProgramChangeLine(
				row({ kind: 'removed', detail: '3 підходи · 10–12 повт.' }),
				'Тренування Б',
			),
		).toBe('Б: Махи')
	})

	it('falls back to the before / after text and to the full name of a custom template', () => {
		expect(
			formatProgramChangeLine(
				row({ kind: 'changed', title: 'Дні тижня', detail: 'було Пн · стало Вт' }),
				'Верх тіла',
			),
		).toBe('Верх тіла: Дні тижня — було Пн · стало Вт')
	})
})
