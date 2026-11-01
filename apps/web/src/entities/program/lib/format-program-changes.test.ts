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
			{ key: '0', kind: 'removed', title: 'Жим ногами', detail: '3 × 10–12 · 120 кг' },
			{
				key: '1',
				kind: 'added',
				title: 'Присідання',
				detail: '3 × 8–12 · 70 кг · +2,5 кг · 120 с',
			},
			{
				key: '2',
				kind: 'changed',
				title: 'Махи гантелями',
				detail: 'було 3 × 12–15 · стало 4 × 12–15',
				after: '4 × 12–15',
			},
		])
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
			{ key: '1', kind: 'changed', title: 'Змінено порядок вправ', detail: null },
			{ key: '2', kind: 'added', title: 'Тренування Б', detail: '1 вправа · ~55 хв' },
		])
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
				row({ kind: 'changed', detail: 'було 3 × 12–15 · стало 4 × 12–15', after: '4 × 12–15' }),
				'Тренування Б',
			),
		).toBe('Б: Махи — 4 × 12–15')
	})

	it('tells an added exercise with its target, no dash', () => {
		expect(
			formatProgramChangeLine(
				row({ title: 'Присідання', detail: '3 × 8–12 · 70 кг' }),
				'Тренування Б',
			),
		).toBe('Б: Присідання 3 × 8–12 · 70 кг')
		expect(formatProgramChangeLine(row({}), 'Тренування Б')).toBe('Б: Махи')
	})

	it('leaves only the name of a removed one', () => {
		expect(
			formatProgramChangeLine(row({ kind: 'removed', detail: '3 × 10–12' }), 'Тренування Б'),
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
