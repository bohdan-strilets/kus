import type { LiveDraft, LiveDraftExercise } from './live-draft.types'

const MS_IN_MINUTE = 60_000

/** Where a set sits in the draft: the exercise row and the set inside it. */
export interface LiveSetRef {
	exerciseIndex: number
	setIndex: number
}

const isEditable = (exercise: LiveDraftExercise): boolean => !exercise.readOnly

/** The sets to do, in the order of the screen: a chat exercise is only shown, so it has none. */
const getPendingSetRefs = (draft: LiveDraft): LiveSetRef[] =>
	draft.exercises.flatMap((exercise, exerciseIndex) =>
		isEditable(exercise)
			? exercise.sets.flatMap((set, setIndex) =>
					set.doneAt === null ? [{ exerciseIndex, setIndex }] : [],
				)
			: [],
	)

/** The first set not done yet; null when everything is done (or there is no set). */
export const getCurrentSet = (draft: LiveDraft): LiveSetRef | null =>
	getPendingSetRefs(draft)[0] ?? null

/** The set after the current one; null when the current is the last one to do. */
export const getNextSet = (draft: LiveDraft): LiveSetRef | null =>
	getPendingSetRefs(draft)[1] ?? null

/** Whole minutes since the session started; 0 without a start or before it (a clock a bit off). */
export const getElapsedMinutes = (startedAt: string | null, now: Date): number => {
	if (startedAt === null) return 0
	return Math.max(0, Math.floor((now.getTime() - new Date(startedAt).getTime()) / MS_IN_MINUTE))
}

/**
 * «Взяти»: the suggested weight goes into the working sets still to do. Done sets and the warm-up
 * are the person's; a bodyweight exercise takes none.
 */
export const applyProgressHint = (exercise: LiveDraftExercise): LiveDraftExercise => {
	const hintKg = exercise.plan?.progressHintKg ?? null
	if (hintKg === null || exercise.isBodyweight === true) return exercise
	return {
		...exercise,
		sets: exercise.sets.map((set) =>
			set.doneAt === null && !set.isWarmup ? { ...set, weightKg: hintKg } : set,
		),
	}
}
