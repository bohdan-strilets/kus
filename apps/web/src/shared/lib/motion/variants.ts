import type { Variants } from 'motion/react'

import { DURATION_MS, EASE, TRANSITION } from './transition'

/** Ported 1:1 from design/src/motion/motion.ts; durations in seconds as Motion expects. */

const BUBBLE_OFFSET_USER_PX = 14
const BUBBLE_OFFSET_KUSIK_PX = 10
const ROW_OFFSET_PX = 6
const ROW_STAGGER_S = 0.06
const TAB_ENTER_OFFSET_PX = 8
const HOP_HEIGHT_PX = 8
const FIELD_ERROR_OFFSET_PX = -4

/** User message: up 14px + fade, base. */
export const enterBubbleVariants: Variants = {
	hidden: { opacity: 0, y: BUBBLE_OFFSET_USER_PX },
	visible: { opacity: 1, y: 0, transition: TRANSITION.base },
}

/** Kusik reply: up 10px + fade, base. */
export const enterReplyVariants: Variants = {
	hidden: { opacity: 0, y: BUBBLE_OFFSET_KUSIK_PX },
	visible: { opacity: 1, y: 0, transition: TRANSITION.base },
}

/** Meal card rows cascade in, 60 ms apart: put on the list, rows use `staggerRowVariants`. */
export const staggerListVariants: Variants = {
	hidden: {},
	visible: { transition: { staggerChildren: ROW_STAGGER_S } },
}

export const staggerRowVariants: Variants = {
	hidden: { opacity: 0, y: ROW_OFFSET_PX },
	visible: { opacity: 1, y: 0, transition: TRANSITION.base },
}

/** «Logged» badge: scale 0 → 1.25 → 1, 300 ms spring. */
export const popInVariants: Variants = {
	hidden: { scale: 0 },
	visible: {
		scale: [0, 1.25, 1],
		transition: { duration: 0.3, ease: EASE.spring, times: [0, 0.6, 1] },
	},
}

/** Hop: hamster changes mood, badge. */
export const hopVariants: Variants = {
	rest: { y: 0 },
	hop: {
		y: [0, -HOP_HEIGHT_PX, 0],
		transition: { duration: 0.3, ease: EASE.spring, times: [0, 0.4, 1] },
	},
}

/** Field error: 300 ms linear shake. */
export const shakeVariants: Variants = {
	rest: { x: 0 },
	shake: { x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.3, ease: 'linear' } },
}

/** Field error text: from −4px, base. */
export const fieldErrorVariants: Variants = {
	hidden: { opacity: 0, y: FIELD_ERROR_OFFSET_PX },
	visible: { opacity: 1, y: 0, transition: TRANSITION.base },
}

/** Bottom sheet: in 320 ms ease-out, out 250 ms ease-in. */
export const sheetVariants: Variants = {
	hidden: { y: '105%', transition: TRANSITION.sheetClose },
	visible: { y: 0, transition: TRANSITION.slow },
}

export const scrimVariants: Variants = {
	hidden: { opacity: 0, transition: TRANSITION.sheetClose },
	visible: { opacity: 1, transition: TRANSITION.slow },
}

/** Tab content and stack screens: from 8px to the right, base. */
export const tabEnterVariants: Variants = {
	hidden: { opacity: 0, x: TAB_ENTER_OFFSET_PX },
	visible: { opacity: 1, x: 0, transition: TRANSITION.base },
}

/** Clarification expands by height, 250 ms. */
export const expandVariants: Variants = {
	collapsed: { height: 0, opacity: 0, transition: TRANSITION.expand },
	expanded: { height: 'auto', opacity: 1, transition: TRANSITION.expand },
}

/** Calorie arc fills over 700 ms; the over-goal arc waits for it plus a 120 ms pause, then 400 ms. */
export const RING_FILL = {
	duration: 0.7,
	overDelay: 0.7 + 0.12,
	overDuration: 0.4,
	ease: EASE.out,
} as const

/** Macro bars: 600 ms, starting 120 ms after the ring, 80 ms apart. */
export const getBarFillTransition = (index: number) => ({
	duration: 0.6,
	delay: 0.12 + index * 0.08,
	ease: EASE.out,
})

const GLOW_NONE = 'drop-shadow(0 0 0 rgba(23,132,90,0))'
const GLOW_PEAK = 'drop-shadow(0 0 14px rgba(23,132,90,.55))'

/** Ring glow when the day goal closes (green is right here: it is success). */
export const ringGlowVariants: Variants = {
	rest: { scale: 1, filter: GLOW_NONE },
	glow: {
		scale: [1, 1.07, 1],
		filter: [GLOW_NONE, GLOW_PEAK, GLOW_NONE],
		transition: { duration: 0.6, ease: EASE.out, times: [0, 0.35, 1] },
	},
}

/** Celebration upper bound — nothing lasts longer. */
export const CELEBRATE_MAX_S = DURATION_MS.celebrateMax / 1000
