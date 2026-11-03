import {
	MAX_EXERCISES_PER_WORKOUT,
	MAX_SET_REPS,
	MAX_SET_WEIGHT_KG,
	MAX_SETS_PER_EXERCISE,
	MAX_WORKOUT_MINUTES,
} from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { makeTemplate } from '@/shared/testing'

import { buildFormDraft } from '../lib/build-form-draft'
import type { WorkoutFormValues } from '../lib/workout-form.types'
import { createWorkoutFormSchema, FORM_FUTURE_TOLERANCE_MIN } from './workout-form.schema'

const NOW = { localDate: '2026-11-02', time: '18:30' }
const schema = createWorkoutFormSchema(i18n.t.bind(i18n), NOW)

const EXERCISE_ID = '0199b3a4-0000-7000-8000-0000000000b1'

const valid = (overrides: Partial<WorkoutFormValues> = {}): WorkoutFormValues => {
	const draft = buildFormDraft(makeTemplate(), { now: NOW, createKey: () => 'k' })
	const [exercise] = draft.exercises
	return {
		...draft,
		exercises: exercise ? [{ ...exercise, templateExerciseId: EXERCISE_ID }] : [],
		...overrides,
	}
}

const messagesOf = (values: WorkoutFormValues): Record<string, string> => {
	const result = schema.safeParse(values)
	if (result.success) return {}
	// the first message per field, as the form resolver shows it
	const entries = result.error.issues.map((issue) => [issue.path.join('.'), issue.message] as const)
	return Object.fromEntries(entries.reverse())
}

const withSet = (patch: Partial<WorkoutFormValues['exercises'][number]['sets'][number]>) => {
	const base = valid()
	const [exercise] = base.exercises
	if (!exercise) throw new Error('no exercise')
	return {
		...base,
		exercises: [
			{
				...exercise,
				sets: exercise.sets.map((set, index) => (index === 0 ? { ...set, ...patch } : set)),
			},
		],
	}
}

describe('createWorkoutFormSchema', () => {
	it('accepts the plan as it is', () => {
		expect(schema.safeParse(valid()).success).toBe(true)
	})

	describe('day and time', () => {
		it.each([['2026-11-02'], ['2026-11-01'], ['2026-10-30']])('accepts %s', (localDate) => {
			expect(messagesOf(valid({ localDate }))).toEqual({})
		})

		it.each([['2026-11-03'], ['2026-10-29'], ['2025-11-02']])('rejects %s', (localDate) => {
			expect(messagesOf(valid({ localDate }))['localDate']).toBe(
				'Обери сьогодні або один із трьох попередніх днів',
			)
		})

		it('rejects a malformed time', () => {
			expect(messagesOf(valid({ startTime: '25:00' }))['startTime']).toBe(
				'Вкажи час, наприклад 19:00',
			)
			expect(messagesOf(valid({ startTime: '' }))['startTime']).toBe('Вкажи час, наприклад 19:00')
		})

		it('rejects a start later than now today, with a tolerance', () => {
			const limit = `18:${30 + FORM_FUTURE_TOLERANCE_MIN}`

			expect(messagesOf(valid({ startTime: limit }))).toEqual({})
			expect(messagesOf(valid({ startTime: '18:36' }))['startTime']).toBe(
				'Початок у майбутньому — вкажи раніше.',
			)
		})

		it('a late start on an earlier day is fine', () => {
			expect(messagesOf(valid({ localDate: '2026-11-01', startTime: '23:59' }))).toEqual({})
		})
	})

	describe('duration', () => {
		it('is required', () => {
			expect(messagesOf(valid({ durationMin: null }))['durationMin']).toBe('Вкажи тривалість')
		})

		it('has bounds', () => {
			expect(messagesOf(valid({ durationMin: 0 }))['durationMin']).toContain('Вкажи від 1 до')
			expect(messagesOf(valid({ durationMin: MAX_WORKOUT_MINUTES + 1 }))['durationMin']).toContain(
				'Вкажи від 1 до',
			)
			expect(messagesOf(valid({ durationMin: 1 }))).toEqual({})
			expect(messagesOf(valid({ durationMin: MAX_WORKOUT_MINUTES }))).toEqual({})
		})

		it('rejects a fraction', () => {
			expect(messagesOf(valid({ durationMin: 12.5 }))['durationMin']).toBe('Вкажи тривалість')
		})
	})

	describe('exercises', () => {
		it('asks to mark at least one exercise when all are skipped', () => {
			const base = valid()
			const skipped = { ...base, exercises: base.exercises.map((e) => ({ ...e, isSkipped: true })) }

			expect(messagesOf(skipped)['exercises']).toBe('Познач хоча б одну вправу')
		})

		it('asks the same for a form without any exercise', () => {
			expect(messagesOf(valid({ exercises: [] }))['exercises']).toBe('Познач хоча б одну вправу')
		})

		it('checks the sets of an active exercise', () => {
			expect(messagesOf(withSet({ reps: MAX_SET_REPS + 1 }))['exercises.0.sets.0.reps']).toContain(
				'Вкажи від 1 до',
			)
			expect(messagesOf(withSet({ reps: 0 }))['exercises.0.sets.0.reps']).toContain(
				'Вкажи від 1 до',
			)
			expect(
				messagesOf(withSet({ weightKg: MAX_SET_WEIGHT_KG + 1 }))['exercises.0.sets.0.weightKg'],
			).toContain('Вкажи від 0 до')
			expect(messagesOf(withSet({ weightKg: -1 }))['exercises.0.sets.0.weightKg']).toContain(
				'Вкажи від 0 до',
			)
		})

		it('accepts the bounds of a set', () => {
			expect(messagesOf(withSet({ reps: MAX_SET_REPS, weightKg: MAX_SET_WEIGHT_KG }))).toEqual({})
			expect(messagesOf(withSet({ reps: null, weightKg: 0 }))).toEqual({})
		})

		it('does not check the sets of a skipped exercise', () => {
			const broken = withSet({ reps: 9999 })
			const first = broken.exercises[0]
			const second = valid().exercises[0]
			if (!first || !second) throw new Error('no exercise')

			const values = {
				...broken,
				exercises: [
					{ ...first, isSkipped: true },
					{ ...second, key: 'second' },
				],
			}

			expect(messagesOf(values)).toEqual({})
		})
	})

	describe('limits', () => {
		const withSets = (count: number): WorkoutFormValues => {
			const base = valid()
			const [exercise] = base.exercises
			if (!exercise) throw new Error('no exercise')
			const [set] = exercise.sets
			if (!set) throw new Error('no set')
			return {
				...base,
				exercises: [{ ...exercise, sets: Array.from({ length: count }, () => set) }],
			}
		}

		it('accepts the maximum of sets and rejects one more with the range message', () => {
			expect(messagesOf(withSets(MAX_SETS_PER_EXERCISE))).toEqual({})
			expect(messagesOf(withSets(MAX_SETS_PER_EXERCISE + 1))['exercises.0.sets']).toBe(
				`Вкажи від 1 до ${MAX_SETS_PER_EXERCISE}`,
			)
		})

		it('accepts the maximum of exercises and rejects one more with the range message', () => {
			const [exercise] = valid().exercises
			if (!exercise) throw new Error('no exercise')
			const many = (count: number) =>
				valid({
					exercises: Array.from({ length: count }, (_, n) => ({ ...exercise, key: `k${n}` })),
				})

			expect(messagesOf(many(MAX_EXERCISES_PER_WORKOUT))).toEqual({})
			expect(messagesOf(many(MAX_EXERCISES_PER_WORKOUT + 1))['exercises']).toBe(
				`Вкажи від 1 до ${MAX_EXERCISES_PER_WORKOUT}`,
			)
		})
	})
})
