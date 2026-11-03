import type { LiveWorkoutResponse } from '@kus/shared'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ExercisePick } from '@/entities/workout'
import { createUuid } from '@/shared/lib'
import { useToast } from '@/shared/ui'

import { adoptServerExercises, buildLiveDraft, toLiveExerciseInputs } from '../lib/build-live-draft'
import type { LiveDraft } from '../lib/live-draft.types'
import {
	addSet,
	addWarmup,
	appendExercise,
	createLiveExercise,
	patchSet,
	setCardioMinutes,
	setSetDone,
} from '../lib/live-draft-edit'
import { applyProgressHint, getCurrentSet, type LiveSetRef } from '../lib/live-set-helpers'
import { notifySetDone } from './set-done-registry'
import { useUnsentSnapshot } from './live-workout-store'
import { type UseLiveSync, useLiveSync } from './use-live-sync'

export interface LiveSession {
	draft: LiveDraft
	sync: UseLiveSync
	/** The set in the edit block: the one the person tapped, else the first still to do. */
	current: LiveSetRef | null
	selectSet: (ref: LiveSetRef) => void
	selectExercise: (exerciseIndex: number) => void
	changeSet: (ref: LiveSetRef, patch: { reps?: number | null; weightKg?: number | null }) => void
	toggleDone: (ref: LiveSetRef) => void
	addSet: (exerciseIndex: number) => void
	addWarmup: (exerciseIndex: number) => void
	addExercise: (pick: ExercisePick) => void
	takeHint: (exerciseIndex: number) => void
	changeCardioMinutes: (exerciseIndex: number, minutes: number) => void
}

const isValidRef = (draft: LiveDraft, ref: LiveSetRef | null): ref is LiveSetRef => {
	if (ref === null) return false
	const exercise = draft.exercises[ref.exerciseIndex]
	// cardio has no sets: its ref points at the exercise itself
	if (exercise === undefined || exercise.readOnly) return false
	return exercise.kind === 'CARDIO' || ref.setIndex < exercise.sets.length
}

/**
 * The state of the live screen: the draft (the server's session plus what was never sent), every
 * change written to the sync at once, the chat's edits taken in when `editedAt` moves (with the
 * toast of G3), and the one hook point `notifySetDone` for the rest timer of 0.10.4.
 */
export const useLiveSession = (live: LiveWorkoutResponse): LiveSession => {
	const { t } = useTranslation()
	const toast = useToast()
	const workoutId = live.workout.id
	const unsent = useUnsentSnapshot(workoutId)
	const [draft, setDraft] = useState(() =>
		buildLiveDraft(live, { unsent: unsent?.exercises ?? null }),
	)
	const [selected, setSelected] = useState<LiveSetRef | null>(null)
	const sync = useLiveSync({ workoutId, initialEditedAt: live.editedAt })
	const draftRef = useRef(draft)
	useEffect(() => {
		draftRef.current = draft
	})
	const { schedule } = sync

	// the chat replaced the session: its exercises come into the draft, ours stay
	const [seenEditedAt, setSeenEditedAt] = useState(live.editedAt)
	const [chatEdits, setChatEdits] = useState(0)
	if (live.editedAt !== seenEditedAt) {
		setSeenEditedAt(live.editedAt)
		setDraft((previous) => adoptServerExercises(previous, live))
		setChatEdits((count) => count + 1)
	}
	useEffect(() => {
		if (chatEdits > 0) toast.show(t('errors.api.WORKOUT_LIVE_CONFLICT'))
	}, [chatEdits, toast, t])

	const commit = (next: LiveDraft): void => {
		draftRef.current = next
		setDraft(next)
		schedule(toLiveExerciseInputs(next))
	}

	const current = isValidRef(draft, selected) ? selected : getCurrentSet(draft)

	return {
		draft,
		sync,
		current,
		selectSet: setSelected,
		selectExercise: (exerciseIndex) => {
			const exercise = draftRef.current.exercises[exerciseIndex]
			if (!exercise || exercise.readOnly) return
			const setIndex = exercise.sets.findIndex((set) => set.doneAt === null)
			setSelected({ exerciseIndex, setIndex: Math.max(0, setIndex) })
		},
		changeSet: (ref, patch) => {
			commit(patchSet(draftRef.current, ref, patch))
		},
		toggleDone: (ref) => {
			const exercise = draftRef.current.exercises[ref.exerciseIndex]
			const set = exercise?.sets[ref.setIndex]
			if (!exercise || !set) return
			const isDone = set.doneAt !== null
			commit(setSetDone(draftRef.current, ref, isDone ? null : new Date().toISOString()))
			setSelected(null)
			if (isDone || exercise.clientKey === null) return
			notifySetDone({
				workoutId,
				exerciseKey: exercise.clientKey,
				setIndex: ref.setIndex,
				restSec: exercise.plan?.restSec ?? null,
			})
		},
		addSet: (exerciseIndex) => {
			const next = addSet(draftRef.current, exerciseIndex)
			commit(next)
			setSelected({
				exerciseIndex,
				setIndex: (next.exercises[exerciseIndex]?.sets.length ?? 1) - 1,
			})
		},
		addWarmup: (exerciseIndex) => {
			commit(addWarmup(draftRef.current, exerciseIndex))
			setSelected({ exerciseIndex, setIndex: 0 })
		},
		addExercise: (pick) => {
			const next = appendExercise(draftRef.current, createLiveExercise(pick, createUuid()))
			commit(next)
			setSelected({ exerciseIndex: next.exercises.length - 1, setIndex: 0 })
		},
		takeHint: (exerciseIndex) => {
			const exercise = draftRef.current.exercises[exerciseIndex]
			if (!exercise) return
			commit({
				...draftRef.current,
				exercises: draftRef.current.exercises.map((item, index) =>
					index === exerciseIndex ? applyProgressHint(exercise) : item,
				),
			})
		},
		changeCardioMinutes: (exerciseIndex, minutes) => {
			commit(setCardioMinutes(draftRef.current, exerciseIndex, minutes))
		},
	}
}
