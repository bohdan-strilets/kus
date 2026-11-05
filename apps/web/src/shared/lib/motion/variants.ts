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

/** Reduced motion: the sheet does not travel, it only fades. */
export const sheetReducedVariants: Variants = {
	hidden: { opacity: 0, transition: TRANSITION.exit },
	visible: { opacity: 1, transition: TRANSITION.slow },
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

/** Reduced motion: the pop has no scale, it only fades in. */
export const popInReducedVariants: Variants = {
	hidden: { opacity: 0 },
	visible: { opacity: 1, transition: TRANSITION.base },
}

/** Hamster hop on mood change — run through animate controls or a key. */
export const HOP_KEYFRAMES = { y: [0, -8, 0] }
export const HOP_TRANSITION: Transition = { duration: 0.3, ease: EASE.spring, times: [0, 0.4, 1] }

/** Field error: 300 ms linear shake. */
export const SHAKE_KEYFRAMES = { x: [0, -6, 6, -4, 4, 0] }
export const SHAKE_TRANSITION: Transition = { duration: 0.3, ease: 'linear' }

/** Achievement card (level 3): pops 0.9 → 1.04 → 1 over 380 ms (design/docs/motion.md). */
export const ACHIEVEMENT_POP_S = 0.38
export const achievementPopVariants: Variants = {
	hidden: { opacity: 0, scale: 0.9 },
	visible: {
		opacity: 1,
		scale: [0.9, 1.04, 1],
		transition: { duration: ACHIEVEMENT_POP_S, ease: EASE.spring, times: [0, 0.6, 1] },
	},
}

/** A set or an exercise row of the live mode leaves to the left before the gap closes. */
export const LIVE_ROW_LEAVE_X_PX = -32
/** Rows of the live mode: a new one grows by height + opacity (y −4 → 0, base), a removed one slides left, fast ease-in. */
export const liveRowVariants: Variants = {
	hidden: { height: 0, opacity: 0, y: -4, overflow: 'hidden' },
	visible: {
		height: 'auto',
		opacity: 1,
		y: 0,
		transition: TRANSITION.base,
		transitionEnd: { overflow: 'visible' },
	},
	gone: { opacity: 0, x: LIVE_ROW_LEAVE_X_PX, transition: TRANSITION.leave },
}

/** Reduced motion: no height, no shift — a live row only fades in and out. */
export const liveRowReducedVariants: Variants = {
	hidden: { opacity: 0 },
	visible: { opacity: 1, transition: TRANSITION.base },
	gone: { opacity: 0, transition: TRANSITION.leave },
}

/** The live screen's content while the surface unfolds: opacity + y 12 → 0, base, after 80 ms; leaves first, fast. */
export const LIVE_CONTENT_DELAY_S = 0.08
export const liveContentVariants: Variants = {
	hidden: { opacity: 0, y: 12 },
	visible: { opacity: 1, y: 0, transition: { ...TRANSITION.base, delay: LIVE_CONTENT_DELAY_S } },
	gone: { opacity: 0, transition: TRANSITION.fast },
}

/**
 * A stepper value rolls: the new one comes in from the side of the change, the old one leaves the
 * other way, ±8 px + opacity, fast. `custom` is +1 for «+», −1 for «−»; 0 is a plain crossfade
 * (the set numbers after a renumbering).
 */
export const STEP_VALUE_SHIFT_PX = 8
export const stepValueVariants: Variants = {
	hidden: (direction: number) => ({ opacity: 0, y: direction * STEP_VALUE_SHIFT_PX }),
	visible: { opacity: 1, y: 0, transition: TRANSITION.fast },
	gone: (direction: number) => ({
		opacity: 0,
		y: -direction * STEP_VALUE_SHIFT_PX,
		transition: TRANSITION.fast,
	}),
}

/** The chat header swaps (full ↔ compact) by opacity + a small shift, base; both headers crossfade. */
export const HEADER_SWAP = {
	initial: { opacity: 0, y: -6 },
	animate: { opacity: 1, y: 0 },
	exit: { opacity: 0, y: -6 },
	transition: TRANSITION.base,
}
