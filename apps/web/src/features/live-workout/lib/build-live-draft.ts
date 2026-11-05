import type {
	LiveExerciseInput,
	LivePlanExercise,
	LiveSetInput,
	LiveWorkoutResponse,
	LiveWorkoutUpdate,
	WorkoutExerciseResponse,
} from '@kus/shared'

import { buildPlanSets, toPlanTarget } from '@/entities/workout'
import { createUuid } from '@/shared/lib'

import type { LiveDraft, LiveDraftExercise, LiveDraftPlan, LiveDraftSet } from './live-draft.types'

export interface BuildLiveDraftOptions {
	/**
	 * The snapshot that never reached the server (from the store). When there is one it is the truth
	 * about the live exercises: it holds what the person did after the last good PUT.
	 */
	unsent?: readonly LiveExerciseInput[] | null
	createKey?: () => string
}

const toPlan = (plan: LivePlanExercise): LiveDraftPlan => ({
	sets: plan.sets,
	repsMin: plan.repsMin,
	repsMax: plan.repsMax,
	weightKg: plan.weightKg,
	progressStepKg: plan.progressStepKg,
	restSec: plan.restSec,
	durationMin: plan.durationMin,
	isBodyweight: plan.isBodyweight,
	lastSets: plan.lastSets,
	progressHintKg: plan.progressHintKg,
})

const fromServerExercise = (exercise: WorkoutExerciseResponse): LiveDraftExercise => ({
	rowKey: exercise.clientKey ?? exercise.id,
	clientKey: exercise.clientKey,
	// readOnly ⇔ no key: the chat (or a form) wrote it, view only in the live mode; a chat rewrite of
	// a live exercise keeps the key and stays editable
	readOnly: exercise.clientKey === null,
	exerciseId: null,
	templateExerciseId: exercise.templateExerciseId,
	name: exercise.name,
	kind: exercise.kind,
	muscleGroup: exercise.muscleGroup,
	isBodyweight: exercise.isBodyweight,
	durationMin: exercise.durationMin,
	distanceM: exercise.distanceM,
	sets: exercise.sets.map(({ reps, weightKg, durationSec, distanceM, isWarmup, doneAt }) => ({
		rowKey: createUuid(),
		reps,
		weightKg,
		durationSec,
		distanceM,
		isWarmup,
		isEdited: false,
		doneAt,
	})),
	plan: null,
})

const fromInput = (input: LiveExerciseInput): LiveDraftExercise => ({
	rowKey: input.clientKey,
	clientKey: input.clientKey,
	readOnly: false,
	exerciseId: input.exerciseId,
	templateExerciseId: input.templateExerciseId,
	name: input.name,
	kind: input.kind,
	muscleGroup: input.muscleGroup,
	isBodyweight: input.isBodyweight,
	durationMin: input.durationMin,
	distanceM: input.distanceM,
	sets: input.sets.map((set) => ({ ...set, rowKey: createUuid(), isEdited: false })),
	plan: null,
})

const fromPlan = (plan: LivePlanExercise, clientKey: string): LiveDraftExercise => ({
	rowKey: clientKey,
	clientKey,
	readOnly: false,
	exerciseId: plan.exerciseId,
	templateExerciseId: plan.templateExerciseId,
	name: plan.name,
	kind: plan.kind,
	muscleGroup: plan.muscleGroup,
	// the dictionary's value stays on the plan: only the person's own choice is sent
	isBodyweight: null,
	// planned cardio is not done until the person sets the minutes (the plan keeps the offer)
	durationMin: null,
	distanceM: null,
	sets: buildPlanSets(toPlanTarget(plan)).map(({ reps, weightKg }) => ({
		rowKey: createUuid(),
		reps,
		weightKg,
		durationSec: null,
		distanceM: null,
		isWarmup: false,
		isEdited: false,
		doneAt: null,
	})),
	plan: toPlan(plan),
})

/**
 * The editable draft of a live session: the plan's exercises first (sets from the server or the
 * unsent snapshot, otherwise the sets the plan says), then the free live exercises, then the
 * exercises the chat wrote (read only). Every live exercise has a stable `clientKey`.
 */
export const buildLiveDraft = (
	live: LiveWorkoutResponse,
	{ unsent = null, createKey = createUuid }: BuildLiveDraftOptions = {},
): LiveDraft => {
	const { workout, plan } = live
	const chat = workout.exercises.filter((exercise) => exercise.clientKey === null)
	const liveBase = unsent
		? unsent.map(fromInput)
		: workout.exercises.filter((exercise) => exercise.clientKey !== null).map(fromServerExercise)
	const remaining = [...liveBase]
	const planned = plan.map((item): LiveDraftExercise => {
		const index = remaining.findIndex(
			(exercise) => exercise.templateExerciseId === item.templateExerciseId,
		)
		const [matched] = index === -1 ? [] : remaining.splice(index, 1)
		return matched ? { ...matched, plan: toPlan(item) } : fromPlan(item, createKey())
	})
	return {
		workoutId: workout.id,
		templateName: live.templateName,
		startedAt: workout.startedAt,
		exercises: [...planned, ...remaining, ...chat.map(fromServerExercise)],
	}
}

/**
 * After the chat rewrote the session (409 EDITED, re-read): an exercise the chat edited in place
 * keeps its `clientKey`, so for every key the server has its values (sets, reps, weights, doneAt)
 * replace the local ones; the screen's own fields (row, plan, dictionary id) stay. Local exercises
 * the server does not know are not sent yet and stay. The chat's own exercises (no key) replace
 * the read-only ones.
 */
export const adoptServerExercises = (draft: LiveDraft, live: LiveWorkoutResponse): LiveDraft => {
	const serverByKey = new Map(
		live.workout.exercises.flatMap((exercise) =>
			exercise.clientKey === null ? [] : [[exercise.clientKey, exercise] as const],
		),
	)
	const localKeys = new Set(draft.exercises.map(({ clientKey }) => clientKey))
	const mine = draft.exercises
		.filter((exercise) => !exercise.readOnly)
		.map((exercise) => {
			const server = exercise.clientKey === null ? undefined : serverByKey.get(exercise.clientKey)
			if (server === undefined) return exercise
			const fromServer = fromServerExercise(server)
			return {
				...exercise,
				templateExerciseId: fromServer.templateExerciseId,
				name: fromServer.name,
				kind: fromServer.kind,
				muscleGroup: fromServer.muscleGroup,
				isBodyweight: fromServer.isBodyweight,
				durationMin: fromServer.durationMin,
				distanceM: fromServer.distanceM,
				// the same place keeps its row, so a chat edit does not remount every set
				sets: fromServer.sets.map((set, index) => ({
					...set,
					rowKey: exercise.sets[index]?.rowKey ?? set.rowKey,
				})),
			}
		})
	const serverOnly = [...serverByKey]
		.filter(([clientKey]) => !localKeys.has(clientKey))
		.map(([, exercise]) => fromServerExercise(exercise))
	const chat = live.workout.exercises
		.filter((exercise) => exercise.clientKey === null)
		.map(fromServerExercise)
	return { ...draft, exercises: [...mine, ...serverOnly, ...chat] }
}

const toSetInput = (set: LiveDraftSet, isBodyweight: boolean | null): LiveSetInput => ({
	reps: set.reps,
	// a bodyweight exercise has no weight on any set (the server rejects it otherwise)
	weightKg: isBodyweight === true ? null : set.weightKg,
	durationSec: set.durationSec,
	distanceM: set.distanceM,
	isWarmup: set.isWarmup,
	doneAt: set.doneAt,
})

type WritableExercise = LiveDraftExercise & { clientKey: string }

const hasContent = (exercise: LiveDraftExercise): boolean =>
	exercise.sets.length > 0 || exercise.durationMin !== null || exercise.distanceM !== null

/** An exercise with nothing in it is nothing to write yet; a chat exercise is never written. */
const isWritable = (exercise: LiveDraftExercise): exercise is WritableExercise =>
	!exercise.readOnly && exercise.clientKey !== null && hasContent(exercise)

/** The exercises of the PUT: the live ones with content (sets or cardio minutes), `isBodyweight` only when the person set it. */
export const toLiveExerciseInputs = (draft: LiveDraft): LiveExerciseInput[] =>
	draft.exercises.filter(isWritable).map((exercise) => ({
		clientKey: exercise.clientKey,
		exerciseId: exercise.exerciseId,
		templateExerciseId: exercise.templateExerciseId,
		name: exercise.name,
		kind: exercise.kind,
		muscleGroup: exercise.muscleGroup,
		isBodyweight: exercise.isBodyweight,
		durationMin: exercise.durationMin,
		distanceM: exercise.distanceM,
		sets: exercise.sets.map((set) => toSetInput(set, exercise.isBodyweight)),
	}))

/** The body of `PUT /live-workouts/:id`. */
export const toLiveUpdate = (
	draft: LiveDraft,
	knownEditedAt: string | null,
): LiveWorkoutUpdate => ({
	knownEditedAt,
	exercises: toLiveExerciseInputs(draft),
})
