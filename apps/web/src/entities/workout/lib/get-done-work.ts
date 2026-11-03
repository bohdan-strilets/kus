import type { WorkoutExerciseResponse } from '@kus/shared'

export type DoneWorkSource = Pick<
	WorkoutExerciseResponse,
	'kind' | 'sets' | 'durationMin' | 'distanceM' | 'clientKey'
>

/**
 * Same rule as the backend's `hasDoneWork`: a set is done when it has `doneAt`, or when its exercise
 * is a chat row (`clientKey` null) — those carry no `doneAt` but are written work. A live-mode
 * exercise (`clientKey` set) without a done set is still planned and is left out; live cardio stays
 * only when it named minutes or distance. Finished sessions keep no undone rows, so they are unchanged.
 */
export const getDoneWork = <T extends DoneWorkSource>(exercises: readonly T[]): T[] =>
	exercises.flatMap((exercise): T[] => {
		if (exercise.clientKey === null) return [exercise]
		if (exercise.kind === 'CARDIO') {
			const hasWork = (exercise.durationMin ?? 0) > 0 || (exercise.distanceM ?? 0) > 0
			return hasWork ? [exercise] : []
		}
		const sets = exercise.sets.filter((set) => set.doneAt !== null)
		return sets.length === 0 ? [] : [{ ...exercise, sets }]
	})
