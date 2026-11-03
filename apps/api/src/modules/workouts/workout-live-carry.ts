import { normalizeExerciseName } from '@kus/shared'

import type { ExerciseWrite, WorkoutWithExercises } from './workouts.repository'

type OldEntry = WorkoutWithExercises['exercises'][number]

/**
 * The old entry each rewritten one is the same exercise as, one-to-one and in order: the same
 * dictionary exercise first, then the same normalized name. Null for an exercise new to the session.
 */
export const matchOldEntries = ({
	oldEntries,
	exercises,
}: {
	/** In their order in the session. */
	oldEntries: readonly OldEntry[]
	exercises: readonly Pick<ExerciseWrite, 'exerciseId' | 'name'>[]
}): (OldEntry | null)[] => {
	const used = new Set<OldEntry>()
	const matched = exercises.map(() => null as OldEntry | null)
	const pair = (isSame: (old: OldEntry, exercise: (typeof exercises)[number]) => boolean): void => {
		exercises.forEach((exercise, index) => {
			if (matched[index] !== null) return
			const old = oldEntries.find((entry) => !used.has(entry) && isSame(entry, exercise))
			if (old === undefined) return
			used.add(old)
			matched[index] = old
		})
	}
	pair((old, exercise) => old.exerciseId !== null && old.exerciseId === exercise.exerciseId)
	pair((old, exercise) => {
		const name = normalizeExerciseName(exercise.name)
		return name !== '' && normalizeExerciseName(old.name) === name
	})
	return matched
}

/**
 * A chat rewrite of an exercise of the live mode keeps what makes it the live mode's: its key, its
 * template exercise and (unless the rewrite names it) its bodyweight flag, and where it came from.
 * Its sets are what the person said happened, so each is done: at the time the set at that place
 * was, else at the time of the edit — otherwise closing the session would drop them as planned-only.
 */
export const carryLiveFields = (
	exercise: ExerciseWrite,
	old: OldEntry,
	{ editedAt, shouldKeepTime }: { editedAt: Date; shouldKeepTime: boolean },
): ExerciseWrite => ({
	...exercise,
	clientKey: old.clientKey,
	templateExerciseId: old.templateExerciseId,
	isBodyweight: exercise.isBodyweight === undefined ? old.isBodyweight : exercise.isBodyweight,
	sourceMessageId: old.sourceMessageId,
	performedAt: shouldKeepTime ? old.performedAt : exercise.performedAt,
	sets: exercise.sets.map((set, index) => ({
		...set,
		doneAt: old.sets[index]?.doneAt ?? editedAt,
	})),
})

/** The time of the edit: now, but never before the session started (a skewed clock). */
export const getEditTime = ({ now, startedAt }: { now: Date; startedAt: Date | null }): Date =>
	startedAt !== null && now < startedAt ? startedAt : now
