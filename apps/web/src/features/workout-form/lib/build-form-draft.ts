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
	planKey: null,
	reps,
	weightKg,
	durationSec: null,
	distanceM: null,
	isWarmup: false,
})

const cloneSets = (sets: readonly FormSetValue[]): FormSetValue[] =>
	sets.map((set) => ({ ...set, rowKey: createUuid(), planKey: set.rowKey }))

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

/**
 * 1-based numbers of the sets that differ from the plan set they were made from: «2-й і 3-й підходи».
 * A set the person added has no plan set, and a deleted one leaves no row: both are in the count
 * (`getPlanCountChange`), not among the ordinals.
 */
export const getChangedSetNumbers = (exercise: FormExerciseValue): number[] => {
	const planned = exercise.plan?.sets ?? []
	return exercise.sets.flatMap((set, index) => {
		if (set.planKey === null) return []
		const plannedSet = planned.find(({ rowKey }) => rowKey === set.planKey)
		return plannedSet && isSameSet(set, plannedSet) ? [] : [index + 1]
	})
}

/** How many working sets there are against the plan (`null`: the same number, or nothing to compare). */
export const getPlanCountChange = (
	exercise: FormExerciseValue,
): { actual: number; planned: number } | null => {
	const { plan } = exercise
	if (plan === null || exercise.kind === 'CARDIO') return null
	const actual = exercise.sets.filter((set) => !set.isWarmup).length
	const planned = plan.sets.filter((set) => !set.isWarmup).length
	return actual === planned ? null : { actual, planned }
}

/** Every plan set is still there and nothing was added: a deleted set and an added one do not cancel out. */
const hasPlanSets = (exercise: FormExerciseValue, plan: FormExercisePlan): boolean =>
	exercise.sets.length === plan.sets.length && exercise.sets.every((set) => set.planKey !== null)

/** «Як за планом» is on only while nothing differs; a skipped exercise and one without a plan are their own states. */
export const getExerciseState = (exercise: FormExerciseValue): FormExerciseState => {
	if (exercise.isSkipped) return 'SKIPPED'
	const { plan } = exercise
	if (plan === null) return 'ADDED'
	const isSame =
		hasPlanSets(exercise, plan) &&
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
