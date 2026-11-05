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

/**
 * The first strength set not done yet; null when everything is done (or there is no set). Strength
 * only on purpose: the rest timer counts the sets still ahead, and an unstarted cardio is not one.
 */
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

/** The explicit selection after a set left its exercise: the removed one is forgotten, later ones move up. */
export const shiftRefAfterSetRemoval = (
	selected: LiveSetRef | null,
	removed: LiveSetRef,
): LiveSetRef | null => {
	if (selected === null || selected.exerciseIndex !== removed.exerciseIndex) return selected
	if (selected.setIndex === removed.setIndex) return null
	return selected.setIndex > removed.setIndex
		? { ...selected, setIndex: selected.setIndex - 1 }
		: selected
}

/** The explicit selection after an exercise left the list. */
export const shiftRefAfterExerciseRemoval = (
	selected: LiveSetRef | null,
	removedIndex: number,
): LiveSetRef | null => {
	if (selected === null || selected.exerciseIndex === removedIndex) return null
	return selected.exerciseIndex > removedIndex
		? { ...selected, exerciseIndex: selected.exerciseIndex - 1 }
		: selected
}

const hasTodo = (exercise: LiveDraftExercise): boolean =>
	!exercise.readOnly &&
	(exercise.kind === 'CARDIO'
		? exercise.durationMin === null
		: exercise.sets.some((set) => set.doneAt === null))

const toTodoRef = (exercise: LiveDraftExercise, exerciseIndex: number): LiveSetRef => ({
	exerciseIndex,
	setIndex: Math.max(
		0,
		exercise.sets.findIndex((set) => set.doneAt === null),
	),
})

/** The first exercise from `fromIndex` on that the person still has to do (a set or cardio minutes); its first set to do. */
export const findNextTodoRef = (draft: LiveDraft, fromIndex: number): LiveSetRef | null => {
	const exerciseIndex = draft.exercises.findIndex(
		(exercise, index) => index >= fromIndex && hasTodo(exercise),
	)
	const exercise = draft.exercises[exerciseIndex]
	return exercise ? toTodoRef(exercise, exerciseIndex) : null
}

/** What is in hand when nothing was picked: the first thing still to do, a planned cardio included. */
export const getFocusRef = (draft: LiveDraft): LiveSetRef | null => findNextTodoRef(draft, 0)

/**
 * The next exercise to do after `exerciseIndex`: forward first, then from the start. Never the
 * exercise itself; done and chat exercises are skipped.
 */
export const findNextTodoAfter = (draft: LiveDraft, exerciseIndex: number): LiveSetRef | null => {
	const count = draft.exercises.length
	for (let step = 1; step <= count; step += 1) {
		const index = (exerciseIndex + step + count) % count
		if (index === exerciseIndex) continue
		const exercise = draft.exercises[index]
		if (exercise && hasTodo(exercise)) return toTodoRef(exercise, index)
	}
	return null
}
