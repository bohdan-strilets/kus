import type { ProgramTemplateResponse } from '@kus/shared'

import { buildPlanSets, toTemplatePlanTarget } from '@/entities/workout'
import { createUuid } from '@/shared/lib'

import { getDefaultStartTime } from './get-default-start-time'
import type {
	FormExercisePlan,
	FormExerciseState,
	FormExerciseValue,
	FormNow,
	FormSetValue,
	WorkoutFormValues,
} from './workout-form.types'

const toFormSet = ({
	reps,
	weightKg,
}: {
	reps: number | null
	weightKg: number | null
}): FormSetValue => ({
	rowKey: createUuid(),
	reps,
	weightKg,
	durationSec: null,
	distanceM: null,
	isWarmup: false,
})

const cloneSets = (sets: readonly FormSetValue[]): FormSetValue[] =>
	sets.map((set) => ({ ...set, rowKey: createUuid() }))

export interface BuildFormDraftOptions {
	now: FormNow
	createKey?: () => string
}

/** One exercise of the template, filled in as the plan says. */
const buildExercise = (
	exercise: ProgramTemplateResponse['exercises'][number],
	createKey: () => string,
): FormExerciseValue => {
	const target = toTemplatePlanTarget(exercise)
	const plan: FormExercisePlan = {
		sets: buildPlanSets(target).map(toFormSet),
		durationMin: target.durationMin,
		distanceM: target.distanceM,
		isBodyweight: target.isBodyweight,
	}
	return {
		key: createKey(),
		exerciseId: exercise.exerciseId,
		templateExerciseId: exercise.id,
		name: exercise.name,
		kind: exercise.kind,
		muscleGroup: exercise.muscleGroup,
		// the dictionary's value is not the person's word: only an explicit choice is sent
		isBodyweight: null,
		durationMin: plan.durationMin,
		distanceM: plan.distanceM,
		sets: cloneSets(plan.sets),
		isSkipped: false,
		plan,
	}
}

/**
 * The form of a template (null: an empty session): today, the start that ends «now», the duration estimate
 * and every exercise filled as the plan says — the person edits only the deviations.
 */
export const buildFormDraft = (
	template: ProgramTemplateResponse | null,
	{ now, createKey = createUuid }: BuildFormDraftOptions,
): WorkoutFormValues => {
	const durationMin = template && template.estimatedMin > 0 ? template.estimatedMin : null
	return {
		localDate: now.localDate,
		startTime: getDefaultStartTime(now.time, durationMin),
		durationMin,
		exercises: template?.exercises.map((exercise) => buildExercise(exercise, createKey)) ?? [],
	}
}

const isSameSet = (a: FormSetValue, b: FormSetValue): boolean =>
	a.reps === b.reps &&
	a.weightKg === b.weightKg &&
	a.durationSec === b.durationSec &&
	a.distanceM === b.distanceM &&
	a.isWarmup === b.isWarmup

/** 1-based numbers of the sets that differ from the plan (extra sets count too): «2-й і 3-й підходи». */
export const getChangedSetNumbers = (exercise: FormExerciseValue): number[] => {
	const planned = exercise.plan?.sets ?? []
	const length = Math.max(planned.length, exercise.sets.length)
	return Array.from({ length }, (_, index) => index).flatMap((index) => {
		const set = exercise.sets[index]
		const plannedSet = planned[index]
		return set && plannedSet && isSameSet(set, plannedSet) ? [] : [index + 1]
	})
}

/** «Як за планом» is on only while nothing differs; a skipped exercise and one without a plan are their own states. */
export const getExerciseState = (exercise: FormExerciseValue): FormExerciseState => {
	if (exercise.isSkipped) return 'SKIPPED'
	const { plan } = exercise
	if (plan === null) return 'ADDED'
	const isSame =
		getChangedSetNumbers(exercise).length === 0 &&
		exercise.durationMin === plan.durationMin &&
		exercise.distanceM === plan.distanceM
	return isSame ? 'PLANNED' : 'CHANGED'
}

/** «Як за планом» pressed: the plan's sets and numbers come back (and a skipped exercise returns). */
export const restorePlan = (exercise: FormExerciseValue): FormExerciseValue => {
	const { plan } = exercise
	if (plan === null) return { ...exercise, isSkipped: false }
	return {
		...exercise,
		sets: cloneSets(plan.sets),
		durationMin: plan.durationMin,
		distanceM: plan.distanceM,
		isSkipped: false,
	}
}
