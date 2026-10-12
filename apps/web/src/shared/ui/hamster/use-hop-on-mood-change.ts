import { animate } from 'motion'
import { useReducedMotion } from 'motion/react'
import { type RefObject, useEffect, useRef } from 'react'

import { HOP_KEYFRAMES, HOP_TRANSITION } from '@/shared/lib'

export const useHopOnMoodChange = (ref: RefObject<SVGSVGElement | null>, mood: string): void => {
	const previousMood = useRef<string>(mood)
	const isReducedMotion = useReducedMotion()

	useEffect(() => {
		if (mood === previousMood.current) return
		// Updated even under reduced motion, so a later toggle does not hop for a stale change
		previousMood.current = mood
		const element = ref.current
		if (!element || isReducedMotion) return
		void animate(element, HOP_KEYFRAMES, HOP_TRANSITION)
	}, [mood, isReducedMotion, ref])
}
