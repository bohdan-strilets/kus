import { describe, expect, it } from 'vitest'

import { NEW_CARDIO_MIN } from '@/entities/workout'
import { i18n } from '@/shared/i18n'
import { makeTemplate, makeTemplateExercise, TEMPLATE_ID } from '@/shared/testing'

import {
	buildFormDraft,
	getChangedSetNumbers,
	getExerciseState,
	restorePlan,
} from './build-form-draft'
import { buildFormPayload } from './build-form-payload'
import {
	addFormSet,
	createFormExercise,
	isFormBodyweight,
	patchFormSet,
} from './form-exercise-edit'
import { formatDateOption } from './format-date-option'
import { formatPlanSummary } from './format-plan-summary'
import { getFormDateOptions } from './get-date-options'
import type { FormExerciseValue } from './workout-form.types'

const NOW = { localDate: '2026-11-02', time: '18:30' }
const REQUEST_ID = '0199b3a4-0000-7000-8000-0000000000d0'

const makeKeys = (): (() => string) => {
	let index = 0
	return () => `key-${index++}`
}

const draftExercise = (
	overrides: Partial<FormExerciseValue> = {},
	templateOverrides = {},
): FormExerciseValue => {
	const draft = buildFormDraft(
		makeTemplate({ exercises: [makeTemplateExercise(templateOverrides)] }),
		{ now: NOW, createKey: makeKeys() },
	)
	return { ...(draft.exercises[0] as FormExerciseValue), ...overrides }
}

describe('buildFormDraft', () => {
	it('fills today, now, the estimate and every exercise as the plan says', () => {
		const draft = buildFormDraft(makeTemplate(), { now: NOW, createKey: makeKeys() })

		expect(draft).toMatchObject({ localDate: '2026-11-02', startTime: '17:35', durationMin: 55 })
		expect(draft.exercises).toHaveLength(1)
		const [exercise] = draft.exercises
		expect(exercise?.key).toBe('key-0')
		expect(exercise?.sets).toHaveLength(3)
		expect(exercise?.sets.every((set) => set.reps === 10 && set.weightKg === 50)).toBe(true)
		expect(exercise?.isSkipped).toBe(false)
		expect(exercise?.isBodyweight).toBeNull()
	})

	it('is an empty session without a template', () => {
		expect(buildFormDraft(null, { now: NOW })).toEqual({
			localDate: '2026-11-02',
			startTime: '18:30',
			durationMin: null,
			exercises: [],
		})
	})

	it('leaves the duration empty for a template without an estimate', () => {
		const draft = buildFormDraft(makeTemplate({ estimatedMin: 0 }), { now: NOW })

		expect(draft.durationMin).toBeNull()
	})

	it('a cardio exercise has its minutes and no sets', () => {
		const cardio = makeTemplateExercise({
			kind: 'CARDIO',
			muscleGroup: null,
			target: {
				sets: null,
				repsMin: null,
				repsMax: null,
				weightKg: null,
				progressStepKg: null,
				restSec: null,
				durationMin: 20,
				distanceM: 3000,
			},
		})

		const [exercise] = buildFormDraft(makeTemplate({ exercises: [cardio] }), { now: NOW }).exercises

		expect(exercise).toMatchObject({ durationMin: 20, distanceM: 3000, sets: [] })
	})

	it("a bodyweight exercise has no weight, and the choice stays the person's", () => {
		const [exercise] = buildFormDraft(
			makeTemplate({ exercises: [makeTemplateExercise({ isBodyweight: true })] }),
			{ now: NOW },
		).exercises

		expect(exercise?.sets.every((set) => set.weightKg === null)).toBe(true)
		expect(exercise?.isBodyweight).toBeNull()
		expect(exercise && isFormBodyweight(exercise)).toBe(true)
	})

	it('takes the weight from the last time when the plan has none', () => {
		const [exercise] = buildFormDraft(
			makeTemplate({
				exercises: [
					makeTemplateExercise({
						target: {
							sets: 2,
							repsMin: 8,
							repsMax: null,
							weightKg: null,
							progressStepKg: null,
							restSec: null,
							durationMin: null,
							distanceM: null,
						},
						lastSets: [{ reps: 8, weightKg: 62.5, isWarmup: false }],
					}),
				],
			}),
			{ now: NOW },
		).exercises

		expect(exercise?.sets.map((set) => [set.reps, set.weightKg])).toEqual([
			[8, 62.5],
			[8, 62.5],
		])
	})

	it('keeps the plan apart from the editable sets (editing does not touch the plan)', () => {
		const exercise = draftExercise()
		const edited = patchFormSet(exercise, 0, { reps: 12 })

		expect(edited.plan?.sets[0]?.reps).toBe(10)
		expect(exercise.sets[0]?.reps).toBe(10)
	})
})

describe('exercise state against the plan', () => {
	it('PLANNED while nothing differs', () => {
		const exercise = draftExercise()

		expect(getExerciseState(exercise)).toBe('PLANNED')
		expect(getChangedSetNumbers(exercise)).toEqual([])
	})

	it('CHANGED when a set differs; the numbers are 1-based', () => {
		const exercise = patchFormSet(patchFormSet(draftExercise(), 1, { reps: 7 }), 2, {
			weightKg: 45,
		})

		expect(getExerciseState(exercise)).toBe('CHANGED')
		expect(getChangedSetNumbers(exercise)).toEqual([2, 3])
	})

	it('an added set is changed, a removed one too', () => {
		const added = addFormSet(draftExercise())
		const removed = { ...draftExercise(), sets: draftExercise().sets.slice(0, 2) }

		expect(getChangedSetNumbers(added)).toEqual([4])
		expect(getChangedSetNumbers(removed)).toEqual([3])
		expect(getExerciseState(removed)).toBe('CHANGED')
	})

	it('SKIPPED wins over everything', () => {
		expect(getExerciseState(draftExercise({ isSkipped: true }))).toBe('SKIPPED')
	})

	it('an exercise the person added has no plan: is ADDED, neither planned nor changed', () => {
		const added = createFormExercise(
			{ name: 'Тяга', exerciseId: null, kind: 'STRENGTH', muscleGroup: 'BACK', lastSets: null },
			'k',
		)

		expect(getExerciseState(added)).toBe('ADDED')
	})

	it('cardio: changed minutes or distance make it CHANGED', () => {
		const cardio = makeTemplateExercise({
			kind: 'CARDIO',
			target: {
				sets: null,
				repsMin: null,
				repsMax: null,
				weightKg: null,
				progressStepKg: null,
				restSec: null,
				durationMin: 20,
				distanceM: null,
			},
		})
		const base = draftExercise({}, cardio)

		expect(getExerciseState(base)).toBe('PLANNED')
		expect(getExerciseState({ ...base, durationMin: 25 })).toBe('CHANGED')
		expect(getExerciseState({ ...base, distanceM: 4000 })).toBe('CHANGED')
	})

	it('restorePlan brings the plan back and un-skips', () => {
		const messy = {
			...patchFormSet(draftExercise(), 0, { reps: 1 }),
			isSkipped: true,
		}

		const restored = restorePlan(messy)

		expect(getExerciseState(restored)).toBe('PLANNED')
		expect(restored.isSkipped).toBe(false)
	})

	it('restorePlan on an exercise without a plan only un-skips it', () => {
		const added = {
			...createFormExercise(
				{ name: 'Тяга', exerciseId: null, kind: 'STRENGTH', muscleGroup: null, lastSets: null },
				'k',
			),
			isSkipped: true,
		}

		const restored = restorePlan(added)

		expect(restored.isSkipped).toBe(false)
		expect(restored.sets).toEqual(added.sets)
	})
})

describe('createFormExercise and edits', () => {
	it('strength starts from the last working sets, else one empty set', () => {
		const withHistory = createFormExercise(
			{
				name: 'Тяга',
				exerciseId: 'e',
				kind: 'STRENGTH',
				muscleGroup: null,
				lastSets: [
					{ reps: 15, weightKg: 20, isWarmup: true },
					{ reps: 8, weightKg: 70, isWarmup: false },
				],
			},
			'k',
		)
		const without = createFormExercise(
			{ name: 'Нова', exerciseId: null, kind: 'STRENGTH', muscleGroup: null, lastSets: null },
			'k',
		)

		expect(withHistory.sets.map((set) => [set.reps, set.weightKg])).toEqual([[8, 70]])
		expect(without.sets).toEqual([
			{ reps: null, weightKg: null, durationSec: null, distanceM: null, isWarmup: false },
		])
	})

	it('cardio has the default minutes and no sets', () => {
		const cardio = createFormExercise(
			{ name: 'Доріжка', exerciseId: null, kind: 'CARDIO', muscleGroup: null, lastSets: null },
			'k',
		)

		expect(cardio).toMatchObject({ durationMin: NEW_CARDIO_MIN, sets: [] })
	})

	it('addFormSet copies the last working set, skipping a trailing warm-up', () => {
		const exercise = draftExercise({
			sets: [
				{ reps: 5, weightKg: 100, durationSec: null, distanceM: null, isWarmup: false },
				{ reps: 15, weightKg: 20, durationSec: null, distanceM: null, isWarmup: true },
			],
		})

		expect(addFormSet(exercise).sets.at(-1)).toMatchObject({
			reps: 5,
			weightKg: 100,
			isWarmup: false,
		})
	})

	it("the person's bodyweight choice beats the dictionary", () => {
		const exercise = draftExercise({ isBodyweight: false })

		expect(isFormBodyweight(exercise)).toBe(false)
		expect(isFormBodyweight(draftExercise({}, { isBodyweight: true }))).toBe(true)
	})
})

describe('buildFormPayload', () => {
	const values = (exercises: FormExerciseValue[]) => ({
		localDate: '2026-11-02',
		startTime: '18:30',
		durationMin: 55,
		exercises,
	})

	it('leaves skipped exercises out and keeps the rest', () => {
		const kept = draftExercise()
		const skipped = draftExercise({ key: 'skipped', name: 'Присід', isSkipped: true })

		const payload = buildFormPayload({
			values: values([kept, skipped]),
			clientRequestId: REQUEST_ID,
			templateId: TEMPLATE_ID,
		})

		expect(payload.exercises.map((exercise) => exercise.name)).toEqual(['Жим лежачи'])
		expect(payload).toMatchObject({
			clientRequestId: REQUEST_ID,
			templateId: TEMPLATE_ID,
			localDate: '2026-11-02',
			startTime: '18:30',
			durationMin: 55,
		})
	})

	it('sends nothing when every exercise is skipped (the schema stops it earlier)', () => {
		const payload = buildFormPayload({
			values: values([draftExercise({ isSkipped: true })]),
			clientRequestId: REQUEST_ID,
			templateId: null,
		})

		expect(payload.exercises).toEqual([])
		expect(payload.templateId).toBeNull()
	})

	it('sends weightKg null on every set of a bodyweight exercise', () => {
		const exercise = draftExercise({ isBodyweight: true })

		const [sent] = buildFormPayload({
			values: values([exercise]),
			clientRequestId: REQUEST_ID,
			templateId: null,
		}).exercises

		expect(sent?.sets.every((set) => set.weightKg === null)).toBe(true)
		expect(sent?.isBodyweight).toBe(true)
	})

	it('trims the name and does not leak the form-only fields', () => {
		const [sent] = buildFormPayload({
			values: values([draftExercise({ name: '  Жим  ' })]),
			clientRequestId: REQUEST_ID,
			templateId: null,
		}).exercises

		expect(sent?.name).toBe('Жим')
		expect(sent).not.toHaveProperty('key')
		expect(sent).not.toHaveProperty('plan')
		expect(sent).not.toHaveProperty('isSkipped')
	})
})

describe('date options', () => {
	it('gives today and three days back, newest first', () => {
		expect(getFormDateOptions('2026-11-02')).toEqual([
			{ localDate: '2026-11-02', daysBack: 0 },
			{ localDate: '2026-11-01', daysBack: 1 },
			{ localDate: '2026-10-31', daysBack: 2 },
			{ localDate: '2026-10-30', daysBack: 3 },
		])
	})

	it('crosses the month and the year', () => {
		expect(getFormDateOptions('2027-01-01').map((option) => option.localDate)).toEqual([
			'2027-01-01',
			'2026-12-31',
			'2026-12-30',
			'2026-12-29',
		])
	})

	it('names today and yesterday, then the weekday and the day', () => {
		const [today, yesterday, twoBack] = getFormDateOptions('2026-11-02')

		expect(today && formatDateOption(today, i18n.t.bind(i18n))).toBe('Сьогодні')
		expect(yesterday && formatDateOption(yesterday, i18n.t.bind(i18n))).toBe('Вчора')
		expect(twoBack && formatDateOption(twoBack, i18n.t.bind(i18n))).toMatch(/31/)
	})
})

describe('formatPlanSummary', () => {
	const t = i18n.t.bind(i18n)

	it('says the plan: sets · weight × reps', () => {
		expect(formatPlanSummary(draftExercise(), t)).toBe('3 підходи · 50 кг × 10')
	})

	it('keeps saying the plan after an edit (it is what «Як за планом» brings back)', () => {
		expect(formatPlanSummary(patchFormSet(draftExercise(), 0, { reps: 3 }), t)).toBe(
			'3 підходи · 50 кг × 10',
		)
	})

	it('says only the reps for bodyweight', () => {
		expect(formatPlanSummary(draftExercise({}, { isBodyweight: true }), t)).toBe(
			'3 підходи · 10 повт.',
		)
	})

	it('cardio: the minutes; none: null', () => {
		const cardio = draftExercise({ kind: 'CARDIO', durationMin: 20, plan: null, sets: [] })

		expect(formatPlanSummary(cardio, t)).toBe('20 хв')
		expect(formatPlanSummary({ ...cardio, durationMin: null }, t)).toBeNull()
		expect(formatPlanSummary(draftExercise({ sets: [], plan: null }), t)).toBeNull()
	})
})
