import type { Transition, Variants } from 'motion/react'

import { EASE, TRANSITION } from './transition'

/** Variants 1:1 with design/src/motion/motion.tokens.ts. */

/** New chat bubble: up 14px + opacity. */
export const bubbleVariants: Variants = {
	hidden: { opacity: 0, y: 14 },
	visible: { opacity: 1, y: 0, transition: TRANSITION.base },
}

/** Meal card rows cascade 60 ms apart: the parent sets staggerChildren: ROW_STAGGER_S. */
export const ROW_STAGGER_S = 0.06
export const rowVariants: Variants = {
	hidden: { opacity: 0, y: 6 },
	visible: { opacity: 1, y: 0, transition: TRANSITION.base },
}

/**
 * A block that opens by height (a folded meal on «Сьогодні»): pair with TRANSITION.expand and an
 * `overflow-hidden` wrapper. MotionConfig reducedMotion skips transforms only, so the caller
 * zeroes the duration under reduced motion.
 */
export const expandVariants: Variants = {
	hidden: { height: 0, opacity: 0 },
	visible: { height: 'auto', opacity: 1 },
}

/** Bottom sheet: opens 320 ms out, closes 250 ms in. */
export const sheetVariants: Variants = {
	hidden: { y: '105%', transition: TRANSITION.exit },
	visible: { y: 0, transition: TRANSITION.slow },
}

export const scrimVariants: Variants = {
	hidden: { opacity: 0, transition: TRANSITION.exit },
	visible: { opacity: 1, transition: TRANSITION.slow },
}

/** Tab content: from 8px to the right. */
export const tabContentVariants: Variants = {
	hidden: { opacity: 0, x: 8 },
	visible: { opacity: 1, x: 0, transition: TRANSITION.base },
}

/** «Logged» badge: 0 → 1.25 → 1. */
export const popInVariants: Variants = {
	hidden: { scale: 0 },
	visible: { scale: [0, 1.25, 1], transition: { ...TRANSITION.pop, times: [0, 0.6, 1] } },
}

/** Hamster hop on mood change — run through animate controls or a key. */
export const HOP_KEYFRAMES = { y: [0, -8, 0] }
export const HOP_TRANSITION: Transition = { duration: 0.3, ease: EASE.spring, times: [0, 0.4, 1] }

/** Field error: 300 ms linear shake. */
export const SHAKE_KEYFRAMES = { x: [0, -6, 6, -4, 4, 0] }
export const SHAKE_TRANSITION: Transition = { duration: 0.3, ease: 'linear' }
