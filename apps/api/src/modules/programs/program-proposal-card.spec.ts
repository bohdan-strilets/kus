import type { ProgramDraft, ProposeProgramInput, TemplateExerciseDraft } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import type { ExerciseRow } from '../workouts/workouts.service'
import { type ProposalSources, toProposalCard, toProposalDraft } from './program-proposal-card'

const KEY_A = '0199b3a4-0000-7000-8000-00000000000a'
const KEY_B = '0199b3a4-0000-7000-8000-00000000000b'
const BENCH_ID = '0199b3a4-0000-7000-8000-0000000000e1'
const SQUAT_ID = '0199b3a4-0000-7000-8000-0000000000e2'
const VERSION_ID = '0199b3a4-0000-7000-8000-0000000000f1'

const benchDraft: TemplateExerciseDraft = {
	name: 'Жим лежачи',
	exerciseId: BENCH_ID,
	kind: 'STRENGTH',
	muscleGroup: 'CHEST',
	target: {
		sets: 3,
		repsMin: 8,
		repsMax: 12,
		weightKg: 60,
		progressStepKg: 5,
		restSec: 120,
		durationMin: null,
		distanceM: null,
	},
}

const base: ProgramDraft = {
	title: 'Все тіло',
	mode: 'SINGLE',
	perWeek: 3,
	templates: [
		{ key: KEY_A, name: 'Тренування А', weekdays: [], exercises: [benchDraft], estimatedMin: 10 },
		{ key: KEY_B, name: 'Тренування Б', weekdays: [], exercises: [], estimatedMin: 5 },
	],
	pinnedKey: KEY_B,
}

const exercise = (
	overrides: Partial<ProposeProgramInput['templates'][number]['exercises'][number]>,
) => ({
	name: 'Жим лежачи',
	exerciseRef: null,
	kind: 'STRENGTH' as const,
	muscleGroup: null,
	sets: 3,
	repsMin: 8,
	repsMax: 12,
	weightKg: 60,
	restSec: null,
	durationMin: null,
	distanceKm: null,
	...overrides,
})

const input = (overrides: Partial<ProposeProgramInput> = {}): ProposeProgramInput => ({
	title: 'Все тіло',
	mode: 'SINGLE',
	perWeek: 3,
	pinnedRef: null,
	templates: [
		{ ref: 't1', name: 'Тренування А', weekdays: [], exercises: [exercise({ exerciseRef: 'x1' })] },
		{ ref: 't2', name: 'Тренування Б', weekdays: [], exercises: [] },
	],
	reply: 'Лишаю як є.',
	...overrides,
})

const sources = (overrides: Partial<ProposalSources> = {}): ProposalSources => ({
	base,
	baseVersionId: VERSION_ID,
	refs: {
		templateKeys: new Map([
			['t1', KEY_A],
			['t2', KEY_B],
		]),
		exerciseIds: new Map([['x1', BENCH_ID]]),
	},
	rows: [],
	...overrides,
})

describe('toProposalDraft x-refs', () => {
	const benchRow: ExerciseRow = {
		id: BENCH_ID,
		name: 'Жим лежачи',
		kind: 'STRENGTH',
		muscleGroup: 'CHEST',
	}
	const draftOf = (name: string, extra: Partial<ProposalSources> = {}) =>
		toProposalDraft(
			{
				...input(),
				templates: [
					{
						ref: null,
						name: 'Тренування А',
						weekdays: [],
						exercises: [exercise({ name, exerciseRef: 'x1' })],
					},
				],
			},
			sources({ refRows: new Map([[BENCH_ID, benchRow]]), ...extra }),
		).templates[0]?.exercises[0]

	it('ignores an x-ref whose exercise is not the one the name says', () => {
		expect(draftOf('Присідання')?.exerciseId).toBeNull()
	})

	it('falls back to the name lookup row when the ref is ignored', () => {
		const squatRow: ExerciseRow = {
			id: SQUAT_ID,
			name: 'Присідання',
			kind: 'STRENGTH',
			muscleGroup: 'LEGS',
		}
		expect(draftOf('Присідання', { rows: [[squatRow]] })?.exerciseId).toBe(SQUAT_ID)
	})

	it('keeps the ref for a shorter wording of the same exercise', () => {
		expect(draftOf('Жим')?.exerciseId).toBe(BENCH_ID)
	})
})

describe('toProposalDraft', () => {
	it('keeps the keys of known t-refs, the x-ref id and the step and rest the model never sees', () => {
		const draft = toProposalDraft(input(), sources())

		expect(draft.templates.map(({ key }) => key)).toEqual([KEY_A, KEY_B])
		expect(draft.templates[0]?.exercises[0]).toMatchObject({
			exerciseId: BENCH_ID,
			muscleGroup: 'CHEST',
			target: { progressStepKg: 5, restSec: 120 },
		})
		expect(draft.pinnedKey).toBe(KEY_B)
	})

	it('gives a new template a fresh key and fills the defaults by kind', () => {
		const squatRow: ExerciseRow = {
			id: SQUAT_ID,
			name: 'Присідання',
			kind: 'STRENGTH',
			muscleGroup: 'LEGS',
		}
		const draft = toProposalDraft(
			{
				...input({ mode: 'ROTATE', pinnedRef: null }),
				templates: [
					{
						ref: null,
						name: 'Ноги',
						weekdays: [5, 2],
						exercises: [
							exercise({ name: 'Присідання', weightKg: 80, muscleGroup: 'CORE' }),
							exercise({ name: 'Віджимання', weightKg: null }),
							exercise({ name: 'Біг', kind: 'CARDIO', sets: null, weightKg: null, distanceKm: 5 }),
						],
					},
				],
			},
			sources({ rows: [[squatRow, null, null]] }),
		)
		const [template] = draft.templates

		expect(template?.key).not.toBe(KEY_A)
		expect(template?.key).not.toBe(KEY_B)
		expect(template?.weekdays).toEqual([2, 5])
		expect(
			template?.exercises.map(({ exerciseId, muscleGroup, target }) => ({
				exerciseId,
				muscleGroup,
				target,
			})),
		).toEqual([
			{
				exerciseId: SQUAT_ID,
				// the dictionary's group beats the model's
				muscleGroup: 'LEGS',
				target: expect.objectContaining({ progressStepKg: 2.5, restSec: 90 }) as unknown,
			},
			{
				exerciseId: null,
				muscleGroup: 'CHEST',
				target: expect.objectContaining({ progressStepKg: null, restSec: 90 }) as unknown,
			},
			{
				exerciseId: null,
				muscleGroup: null,
				target: expect.objectContaining({
					progressStepKg: null,
					restSec: null,
					distanceM: 5000,
				}) as unknown,
			},
		])
		expect(template?.estimatedMin).toBeGreaterThan(0)
		// the old pin's template is gone
		expect(draft.pinnedKey).toBeNull()
	})

	it('pins the template the model names; a t-ref of the turn nowhere else is a new one', () => {
		const draft = toProposalDraft(input({ pinnedRef: 't1' }), sources())
		const fresh = toProposalDraft(
			input(),
			sources({
				base: null,
				baseVersionId: null,
				refs: { templateKeys: new Map(), exerciseIds: new Map() },
			}),
		)

		expect(draft.pinnedKey).toBe(KEY_A)
		expect(fresh.templates.map(({ key }) => key)).not.toContain(KEY_A)
	})

	it('keeps the key of an open proposal template without a program (no step or rest to keep)', () => {
		const draft = toProposalDraft(input(), sources({ base: null, baseVersionId: null }))

		expect(draft.templates.map(({ key }) => key)).toEqual([KEY_A, KEY_B])
		expect(draft.templates[0]?.exercises[0]?.target.progressStepKg).not.toBe(5)
	})
})

describe('toProposalCard', () => {
	it('is null when the program already is that, the pin included', () => {
		const draft = toProposalDraft(input(), sources())

		expect(toProposalCard(draft, { base, baseVersionId: VERSION_ID })).toBeNull()
		expect(
			toProposalCard({ ...draft, pinnedKey: KEY_A }, { base, baseVersionId: VERSION_ID }),
		).not.toBeNull()
	})

	it('carries the base version and the diff lines of a change', () => {
		const draft = toProposalDraft(
			input({
				templates: [
					{
						ref: 't1',
						name: 'Тренування А',
						weekdays: [],
						exercises: [exercise({ name: 'Присідання', weightKg: 80 })],
					},
					{ ref: 't2', name: 'Тренування Б', weekdays: [], exercises: [] },
				],
			}),
			sources(),
		)
		const card = toProposalCard(draft, { base, baseVersionId: VERSION_ID })

		expect(card).toMatchObject({ v: 1, baseVersionId: VERSION_ID, changes: { initial: false } })
		expect(card?.changes.lines.map(({ op, name }) => `${op} ${name}`)).toEqual([
			'ADD Присідання',
			'REMOVE Жим лежачи',
		])
	})

	it('marks the first program as initial', () => {
		const draft = toProposalDraft(input(), sources({ base: null, baseVersionId: null }))

		expect(toProposalCard(draft, { base: null, baseVersionId: null })).toMatchObject({
			baseVersionId: null,
			changes: { initial: true, lines: [] },
		})
	})
})
