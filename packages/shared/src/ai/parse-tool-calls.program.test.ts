import { describe, expect, it } from 'vitest'

import type { ParseRefs } from './entry-edits.js'
import { parseToolCalls, type RawToolCall } from './parse-tool-calls.js'

const refs: ParseRefs = {
	memoryRefs: new Set(),
	entries: new Map(),
	deletedEntryRefs: new Set(),
	clarifications: new Map(),
	today: '2026-11-01',
	measurementDays: new Set(),
	exerciseRefs: new Set(['x1']),
	templateRefs: new Set(['t1', 't2']),
}

const call = (name: string, input: unknown): RawToolCall => ({
	name,
	arguments: JSON.stringify(input),
})

const bench = { name: 'Жим лежачи', kind: 'STRENGTH', sets: 3, repsMin: 8, repsMax: 12 }
const run = { name: 'Бігова доріжка', kind: 'CARDIO', durationMin: 10 }

const template = (overrides: Record<string, unknown> = {}) => ({
	ref: null,
	name: 'Тренування А',
	exercises: [run, bench],
	...overrides,
})

const propose = (overrides: Record<string, unknown> = {}): RawToolCall =>
	call('propose_program', {
		mode: 'ROTATE',
		templates: [template()],
		reply: 'Почнемо з двох тренувань на все тіло.',
		...overrides,
	})

const errorsOf = (raw: RawToolCall[]): string[] => {
	const result = parseToolCalls(raw, refs)
	return result.ok ? [] : result.errors
}

describe('parseToolCalls with propose_program', () => {
	it('reads a new program with every default filled', () => {
		const result = parseToolCalls([propose({ perWeek: 2 })], refs)

		expect(result).toMatchObject({
			ok: true,
			decision: {
				kind: 'program',
				program: {
					title: null,
					mode: 'ROTATE',
					perWeek: 2,
					pinnedRef: null,
					templates: [
						{
							ref: null,
							weekdays: [],
							exercises: [
								{ name: 'Бігова доріжка', durationMin: 10, weightKg: null, exerciseRef: null },
								{ name: 'Жим лежачи', sets: 3, repsMin: 8, repsMax: 12, restSec: null },
							],
						},
					],
				},
			},
		})
	})

	it('keeps known t-refs and x-refs and a pin on one of the templates', () => {
		const result = parseToolCalls(
			[
				propose({
					mode: 'SINGLE',
					pinnedRef: 't1',
					templates: [
						template({ ref: 't1', exercises: [{ ...bench, exerciseRef: 'x1' }] }),
						template({ ref: 't2', name: 'Тренування Б' }),
					],
				}),
			],
			refs,
		)

		expect(result.ok).toBe(true)
	})

	it('rejects a t-ref that is not in «Program», and a repeated one', () => {
		expect(errorsOf([propose({ templates: [template({ ref: 't3' })] })])).toEqual([
			'propose_program: templates.0.ref "t3" is not in "Program"',
		])
		expect(
			errorsOf([propose({ templates: [template({ ref: 't1' }), template({ ref: 't1' })] })]),
		).toEqual(['propose_program: templates.1.ref "t1" repeats — one template per ref'])
	})

	it('rejects an unknown x-ref, a pin outside the templates, a reversed range and a repeated day', () => {
		const errors = errorsOf([
			propose({
				mode: 'SINGLE',
				pinnedRef: 't2',
				templates: [
					template({
						ref: 't1',
						weekdays: [1, 1],
						exercises: [{ ...bench, exerciseRef: 'x9', repsMin: 12, repsMax: 8 }],
					}),
				],
			}),
		])

		expect(errors).toEqual([
			'propose_program: templates.0.weekdays repeat a day',
			'propose_program: templates.0.exercises.0.exerciseRef "x9" is not in "Exercises"',
			'propose_program: templates.0.exercises.0 has repsMin above repsMax',
			'propose_program: pinnedRef "t2" is not a ref of these templates',
		])
	})

	it('holds the limits: 1–7 templates, 1–15 exercises, sets 1–10, weight up to 500', () => {
		const many = (count: number, item: unknown) => Array.from({ length: count }, () => item)

		expect(errorsOf([propose({ templates: [] })])).toHaveLength(1)
		expect(errorsOf([propose({ templates: many(8, template()) })])).toHaveLength(1)
		expect(errorsOf([propose({ templates: [template({ exercises: [] })] })])).toHaveLength(1)
		expect(
			errorsOf([propose({ templates: [template({ exercises: many(16, bench) })] })]),
		).toHaveLength(1)
		expect(
			errorsOf([propose({ templates: [template({ exercises: [{ ...bench, sets: 11 }] })] })]),
		).toHaveLength(1)
		expect(
			errorsOf([propose({ templates: [template({ exercises: [{ ...bench, weightKg: 501 }] })] })]),
		).toHaveLength(1)
		expect(
			errorsOf([propose({ templates: [template({ exercises: [{ ...bench, restSec: 10 }] })] })]),
		).toHaveLength(1)
	})

	it('goes alone: never with reply or a second propose_program', () => {
		const alone =
			'propose_program is the whole answer — exactly one call and no other tool, not even reply'

		expect(errorsOf([propose(), call('reply', { text: 'Ось програма.' })])).toEqual([alone])
		expect(errorsOf([propose(), propose()])).toEqual([alone])
	})
})

describe('parseToolCalls with log_workout.templateRef', () => {
	const workout = (templateRef: string | null): RawToolCall =>
		call('log_workout', {
			exercises: [{ name: 'Присідання', kind: 'STRENGTH', sets: [{ reps: 8, count: 3 }] }],
			templateRef,
			reply: 'Записав тренування Б.',
		})

	it('reads a known t-ref and defaults to null', () => {
		const bound = parseToolCalls([workout('t2')], refs)
		const unbound = parseToolCalls(
			[
				call('log_workout', {
					exercises: [{ name: 'Присідання', kind: 'STRENGTH' }],
					reply: 'Записав.',
				}),
			],
			refs,
		)

		expect(bound).toMatchObject({ ok: true, decision: { workouts: [{ templateRef: 't2' }] } })
		expect(unbound).toMatchObject({ ok: true, decision: { workouts: [{ templateRef: null }] } })
	})

	it('rejects a t-ref that is not in «Program»', () => {
		expect(errorsOf([workout('t5')])).toEqual(['log_workout: templateRef "t5" is not in "Program"'])
	})
})
