import { useAnimate, useReducedMotion } from 'motion/react'
import { type RefObject, useEffect } from 'react'

import { SHAKE_KEYFRAMES, SHAKE_TRANSITION } from '@/shared/lib'

/**
 * Shakes the element behind the returned ref when an error appears or changes, and again on every
 * failed attempt with the same message (`attemptCount`). Silent under reduced motion.
 */
export const useShakeOnError = (
	error: string | undefined,
	attemptCount: number,
): RefObject<HTMLDivElement | null> => {
	const [ref, animate] = useAnimate<HTMLDivElement>()
	const shouldReduceMotion = useReducedMotion()

	useEffect(() => {
		if (!error || shouldReduceMotion) return
		void animate(ref.current, SHAKE_KEYFRAMES, SHAKE_TRANSITION)
	}, [error, attemptCount, shouldReduceMotion, animate, ref])

	return ref
}
