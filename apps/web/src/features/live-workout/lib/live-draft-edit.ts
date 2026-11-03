import { DEFAULT_PROGRESS_STEP_KG } from '@kus/shared'

import { type ExercisePick, NEW_CARDIO_MIN } from '@/entities/workout'

import type { LiveDraft, LiveDraftExercise, LiveDraftSet } from './live-draft.types'
import type { LiveSetRef } from './live-set-helpers'

const emptySet = (): LiveDraftSet => ({
	reps: null,
	weightKg: null,
	durationSec: null,
	distanceM: null,
	isWarmup: false,
	doneAt: null,
})

/** The weight a bodyweight exercise has none of: the person's own switch beats the dictionary. */
export const isBodyweightExercise = (exercise: LiveDraftExercise): boolean =>
	exercise.isBodyweight ?? exercise.plan?.isBodyweight ?? false

/** The weight moves by the plan's step (the template's, else the default). */
export const getWeightStepKg = (exercise: LiveDraftExercise): number =>
	exercise.plan?.progressStepKg ?? DEFAULT_PROGRESS_STEP_KG

/** Where a set is counted from: warm-ups have no number. */
export const getWorkingNumber = (exercise: LiveDraftExercise, setIndex: number): number =>
	exercise.sets.slice(0, setIndex + 1).filter((set) => !set.isWarmup).length

const mapExercise = (
	draft: LiveDraft,
	index: number,
	update: (exercise: LiveDraftExercise) => LiveDraftExercise,
): LiveDraft => ({
	...draft,
	exercises: draft.exercises.map((exercise, position) =>
		position === index && !exercise.readOnly ? update(exercise) : exercise,
	),
})

export const patchSet = (
	draft: LiveDraft,
	{ exerciseIndex, setIndex }: LiveSetRef,
	patch: Partial<Pick<LiveDraftSet, 'reps' | 'weightKg'>>,
): LiveDraft =>
	mapExercise(draft, exerciseIndex, (exercise) => ({
		...exercise,
		sets: exercise.sets.map((set, position) =>
			position === setIndex ? { ...set, ...patch } : set,
		),
	}))

/** «Підхід виконано» stamps the time; the ✓ pressed again takes it back. */
export const setSetDone = (draft: LiveDraft, ref: LiveSetRef, doneAt: string | null): LiveDraft =>
	mapExercise(draft, ref.exerciseIndex, (exercise) => ({
		...exercise,
		sets: exercise.sets.map((set, position) =>
			position === ref.setIndex ? { ...set, doneAt } : set,
		),
	}))

/** «+ Підхід»: a copy of the last working set, still to do. */
export const addSet = (draft: LiveDraft, exerciseIndex: number): LiveDraft =>
	mapExercise(draft, exerciseIndex, (exercise) => {
		const last = [...exercise.sets].reverse().find((set) => !set.isWarmup)
		return { ...exercise, sets: [...exercise.sets, { ...(last ?? emptySet()), doneAt: null }] }
	})

/** «+ Розминка»: at the front, the reps of the first working set, the weight left to the person. */
export const addWarmup = (draft: LiveDraft, exerciseIndex: number): LiveDraft =>
	mapExercise(draft, exerciseIndex, (exercise) => {
		const first = exercise.sets.find((set) => !set.isWarmup)
		const warmup: LiveDraftSet = { ...emptySet(), reps: first?.reps ?? null, isWarmup: true }
		return { ...exercise, sets: [warmup, ...exercise.sets] }
	})

export const setCardioMinutes = (
	draft: LiveDraft,
	exerciseIndex: number,
	durationMin: number,
): LiveDraft => mapExercise(draft, exerciseIndex, (exercise) => ({ ...exercise, durationMin }))

/** An exercise picked in «+ Вправа»: its last working sets are the start, else one empty set. */
export const createLiveExercise = (pick: ExercisePick, clientKey: string): LiveDraftExercise => {
	const base = {
		rowKey: clientKey,
		clientKey,
		readOnly: false,
		exerciseId: pick.exerciseId,
		templateExerciseId: null,
		name: pick.name,
		kind: pick.kind,
		muscleGroup: pick.muscleGroup,
		isBodyweight: null,
		distanceM: null,
		plan: null,
	}
	if (pick.kind === 'CARDIO') return { ...base, durationMin: NEW_CARDIO_MIN, sets: [] }
	const last = (pick.lastSets ?? []).filter((set) => !set.isWarmup)
	const sets =
		last.length > 0
			? last.map(({ reps, weightKg }) => ({ ...emptySet(), reps, weightKg }))
			: [emptySet()]
	return { ...base, durationMin: null, sets }
}

export const appendExercise = (draft: LiveDraft, exercise: LiveDraftExercise): LiveDraft => ({
	...draft,
	exercises: [...draft.exercises, exercise],
})

/** Every set done (strength) or any cardio: the row is shown as finished. */
export const isExerciseDone = (exercise: LiveDraftExercise): boolean =>
	exercise.kind === 'CARDIO'
		? exercise.durationMin !== null
		: exercise.sets.length > 0 && exercise.sets.every((set) => set.doneAt !== null)

/** Sets done in the whole session (chat exercises are not the live mode's own). */
export const countDoneSets = (draft: LiveDraft): number =>
	draft.exercises.reduce(
		(sum, exercise) =>
			exercise.readOnly ? sum : sum + exercise.sets.filter((set) => set.doneAt !== null).length,
		0,
	)
