import { DEFAULT_REST_SEC } from '@kus/shared'

import type { LiveDraft, LiveDraftExercise } from './live-draft.types'

export interface LastDoneSet {
	doneAt: string
	exerciseIndex: number
	restSec: number
	/** A cardio the person has begun comes after this set: the strength part is over, no rest. */
	isFollowedByCardio: boolean
}

const isBegunCardio = (exercise: LiveDraftExercise): boolean =>
	exercise.kind === 'CARDIO' &&
	!exercise.readOnly &&
	(exercise.durationMin !== null || exercise.distanceM !== null)

/**
 * The set done last in the draft (by `doneAt`) and the rest its exercise asks. Read from the
 * draft, so a deleted set hands the timer over to the one before it.
 */
export const getLastDoneSet = (draft: LiveDraft): LastDoneSet | null => {
	let last: LastDoneSet | null = null
	let lastMs = -Infinity
	for (const [exerciseIndex, exercise] of draft.exercises.entries()) {
		if (exercise.readOnly) continue
		for (const set of exercise.sets) {
			if (set.doneAt === null) continue
			const doneMs = new Date(set.doneAt).getTime()
			if (Number.isNaN(doneMs) || doneMs < lastMs) continue
			lastMs = doneMs
			last = {
				doneAt: set.doneAt,
				exerciseIndex,
				restSec: exercise.plan?.restSec ?? DEFAULT_REST_SEC,
				isFollowedByCardio: false,
			}
		}
	}
	if (last === null) return null
	const lastIndex = last.exerciseIndex
	return {
		...last,
		isFollowedByCardio: draft.exercises.some(
			(exercise, index) => index > lastIndex && isBegunCardio(exercise),
		),
	}
}
