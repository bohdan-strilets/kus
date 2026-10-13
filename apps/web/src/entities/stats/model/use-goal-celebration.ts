import { animate } from 'motion'
import { type RefObject, useEffect, useRef } from 'react'

import { burst, CELEBRATE, EASE, isReducedMotion, playSound, RING_FILL_MS } from '@/shared/lib'

import { markGoalCelebrated } from '../lib/goal-celebrated-flag'
import { type GoalCelebration, useGoalCelebrationStore } from './goal-celebration-store'

/** Under reduced motion the ring is full at once; the pause keeps «goal» out of the 150 ms throttle after «kusik». */
export const GOAL_AFTER_KUSIK_MS = 450
const GLOW_DURATION_S = 0.6
const GLOW_PEAK_OPACITY = 0.6
const GLOW_PEAK_SCALE = 1.07
const GLOW_PEAK_AT = 0.35

interface UseGoalCelebrationParams {
	/** Without them (a ring that does not celebrate) the hook does nothing. */
	userId: string | undefined
	today: string | undefined
	/** position: relative, overflow visible: the particles live inside it. */
	hostRef: RefObject<HTMLElement | null>
	/** The particles fly out of its centre. */
	originRef: RefObject<Element | null>
	glowRef: RefObject<HTMLElement | null>
	particleDistance: number
}

/**
 * Plays the level 2 celebration (design/docs/motion.md) in the ring that is on screen: once the
 * ring has filled, the sound, the glow, 12 particles and the happy face go together. The event is
 * consumed the moment it appears, but the day is marked as celebrated only when the timer fires;
 * a ring that unmounts before that puts the event back for the next one (the TTL drops a stale one).
 * A quiet event (a level 3 achievement came with it) still marks the day and swaps the face, but
 * has no sound, glow or particles.
 */
export const useGoalCelebration = ({
	userId,
	today,
	hostRef,
	originRef,
	glowRef,
	particleDistance,
}: UseGoalCelebrationParams): void => {
	const hasPending = useGoalCelebrationStore((state) => state.pending !== null)
	const timerRef = useRef<number | null>(null)
	const eventRef = useRef<GoalCelebration | null>(null)

	useEffect(() => {
		if (!hasPending || userId === undefined || today === undefined) return
		// one celebration per ring at a time: the next event waits in the store
		if (timerRef.current !== null) return
		const event = useGoalCelebrationStore.getState().consume({ userId, today })
		if (event === null) return

		eventRef.current = event
		// not cleared by this effect's cleanup: consume() empties pending and re-runs it
		timerRef.current = window.setTimeout(
			() => {
				timerRef.current = null
				eventRef.current = null
				markGoalCelebrated(userId, event.localDate)
				const isReduced = isReducedMotion()
				// an achievement of the same reply has the stage: its sound and confetti are not mixed with ours
				if (!event.isQuiet) playSound('goal')
				useGoalCelebrationStore.getState().revealReply(event.messageId)
				if (event.isQuiet || isReduced) return
				if (glowRef.current) {
					void animate(
						glowRef.current,
						{ opacity: [0, GLOW_PEAK_OPACITY, 0], scale: [1, GLOW_PEAK_SCALE, 1] },
						{ duration: GLOW_DURATION_S, times: [0, GLOW_PEAK_AT, 1], ease: EASE.out },
					)
				}
				if (hostRef.current && originRef.current) {
					burst(hostRef.current, originRef.current, {
						...CELEBRATE.goal,
						distance: particleDistance,
					})
				}
			},
			isReducedMotion() ? GOAL_AFTER_KUSIK_MS : RING_FILL_MS,
		)
	}, [hasPending, userId, today, hostRef, originRef, glowRef, particleDistance])

	useEffect(
		() => () => {
			if (timerRef.current === null) return
			window.clearTimeout(timerRef.current)
			timerRef.current = null
			if (eventRef.current !== null) {
				useGoalCelebrationStore.getState().restorePending(eventRef.current)
				eventRef.current = null
			}
		},
		[],
	)
}
