import type { LiveExerciseInput, WorkoutExerciseResponse } from '@kus/shared'

/** The live exercise the server holds as a PUT would write it; `exerciseId` is the local one when known. */
const toLiveInput = (
	exercise: WorkoutExerciseResponse,
	clientKey: string,
	exerciseId: string | null,
): LiveExerciseInput => ({
	clientKey,
	exerciseId,
	templateExerciseId: exercise.templateExerciseId,
	name: exercise.name,
	kind: exercise.kind,
	muscleGroup: exercise.muscleGroup,
	isBodyweight: exercise.isBodyweight,
	durationMin: exercise.durationMin,
	distanceM: exercise.distanceM,
	sets: exercise.sets.map(({ reps, weightKg, durationSec, distanceM, isWarmup, doneAt }) => ({
		reps,
		weightKg,
		durationSec,
		distanceM,
		isWarmup,
		doneAt,
	})),
})

/**
 * After a 409 EDITED: the chat rewrote these exercises in place and kept their keys, so for every
 * key the server has, the server's version replaces the unsent one (the old value must not come
 * back with the next PUT). Unsent exercises the server does not know stay and are sent again; a
 * live exercise only the server has is kept, or the next PUT would delete it.
 */
export const mergeServerInputs = (
	unsent: readonly LiveExerciseInput[],
	server: readonly WorkoutExerciseResponse[],
): LiveExerciseInput[] => {
	const serverByKey = new Map(
		server.flatMap((exercise) =>
			exercise.clientKey === null ? [] : [[exercise.clientKey, exercise] as const],
		),
	)
	const merged = unsent.map((input) => {
		const fromServer = serverByKey.get(input.clientKey)
		return fromServer === undefined
			? input
			: toLiveInput(fromServer, input.clientKey, input.exerciseId)
	})
	const sentKeys = new Set(unsent.map(({ clientKey }) => clientKey))
	const serverOnly = [...serverByKey].flatMap(([clientKey, exercise]) =>
		sentKeys.has(clientKey) ? [] : [toLiveInput(exercise, clientKey, null)],
	)
	return [...merged, ...serverOnly]
}
