import { useEffect, useRef, useState } from 'react'

import { playSound } from '@/shared/lib'

import { getLastDoneSet } from '../lib/get-last-done-set'
import { getRestState, REST_EXTEND_SEC, type RestState } from '../lib/get-rest-state'
import type { LiveDraft, LiveDraftExercise, LiveDraftSet } from '../lib/live-draft.types'
import { getWorkingNumber } from '../lib/live-draft-edit'
import { getCurrentSet } from '../lib/live-set-helpers'

const TICK_MS = 500
/** The signal is for an end the person is looking at; an end met on coming back is silent. */
const END_SIGNAL_WINDOW_MS = 1500

/** The set the rest is before. */
export interface RestNext {
	exercise: LiveDraftExercise
	set: LiveDraftSet
	/** The number among the working sets of its exercise. */
	setNumber: number
	/** The next set belongs to another exercise than the one done last. */
	isOtherExercise: boolean
}

export interface RestTimer {
	state: RestState
	next: RestNext | null
	extend: () => void
	skip: () => void
}

/** The «+15 с» and «Пропустити» of one rest; the key is the `doneAt` it belongs to. */
interface RestAdjust {
	doneAt: string
	extraSec: number
	isSkipped: boolean
}

const isVisible = (): boolean => document.visibilityState === 'visible'

/**
 * The rest timer of 0.10.4: derived from the `doneAt` of the set done last, so it survives a
 * reload and a locked phone. The tick only re-renders; «+15 с» and «Пропустити» are local and
 * die with the next ✓. The signal fires once, when the end comes while the screen is visible.
 */
export const useRestTimer = (draft: LiveDraft): RestTimer => {
	const last = getLastDoneSet(draft)
	const nextRef = getCurrentSet(draft)
	const [adjust, setAdjust] = useState<RestAdjust | null>(null)
	const [nowMs, setNowMs] = useState(() => Date.now())

	const ownAdjust = adjust !== null && adjust.doneAt === last?.doneAt ? adjust : null
	const state = getRestState({
		lastDoneAt: last?.doneAt ?? null,
		restSec: last?.restSec ?? 0,
		extraSec: ownAdjust?.extraSec ?? 0,
		isSkipped: ownAdjust?.isSkipped ?? false,
		hasNextSet: nextRef !== null,
		nowMs,
	})

	const isRunning = state.status === 'running'
	useEffect(() => {
		if (!isRunning) return
		const refresh = (): void => {
			setNowMs(Date.now())
		}
		const timer = setInterval(refresh, TICK_MS)
		document.addEventListener('visibilitychange', refresh)
		return () => {
			clearInterval(timer)
			document.removeEventListener('visibilitychange', refresh)
		}
	}, [isRunning])

	const previousStatus = useRef(state.status)
	const overdueMs = state.status === 'ended' ? state.overdueMs : null
	useEffect(() => {
		const wasRunning = previousStatus.current === 'running'
		previousStatus.current = state.status
		if (!wasRunning || overdueMs === null) return
		if (overdueMs <= END_SIGNAL_WINDOW_MS && isVisible()) playSound('remind')
	}, [state.status, overdueMs])

	const nextExercise = nextRef === null ? undefined : draft.exercises[nextRef.exerciseIndex]
	const nextSet = nextRef === null ? undefined : nextExercise?.sets[nextRef.setIndex]
	const next: RestNext | null =
		nextRef === null || nextExercise === undefined || nextSet === undefined
			? null
			: {
					exercise: nextExercise,
					set: nextSet,
					setNumber: getWorkingNumber(nextExercise, nextRef.setIndex),
					isOtherExercise: nextRef.exerciseIndex !== last?.exerciseIndex,
				}

	return {
		state,
		next,
		extend: () => {
			if (last === null) return
			setNowMs(Date.now())
			setAdjust({
				doneAt: last.doneAt,
				extraSec: (ownAdjust?.extraSec ?? 0) + REST_EXTEND_SEC,
				isSkipped: false,
			})
		},
		skip: () => {
			if (last === null) return
			setAdjust({ doneAt: last.doneAt, extraSec: ownAdjust?.extraSec ?? 0, isSkipped: true })
		},
	}
}
