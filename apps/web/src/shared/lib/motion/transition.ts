import type { Transition } from 'motion/react'

/** design/docs/motion.md: fast — press, base — bubbles and tabs, slow — sheet, switch, tab pill. */
export const DURATION_MS = { fast: 120, base: 200, slow: 320, celebrateMax: 1000 } as const

type CubicBezier = [number, number, number, number]

export const EASE = {
	/** everything that appears */
	out: [0.2, 0.8, 0.2, 1],
	/** lively feedback: badge, hamster, switch */
	spring: [0.34, 1.56, 0.64, 1],
	/** everything that disappears */
	in: [0.4, 0, 1, 1],
	/** counters (ease-out cubic, as in design/src countUp) */
	outCubic: [0.33, 1, 0.68, 1],
} as const satisfies Record<string, CubicBezier>

const toSeconds = (ms: number): number => ms / 1000

export const TRANSITION = {
	fast: { duration: toSeconds(DURATION_MS.fast), ease: EASE.out },
	base: { duration: toSeconds(DURATION_MS.base), ease: EASE.out },
	slow: { duration: toSeconds(DURATION_MS.slow), ease: EASE.out },
	slowSpring: { duration: toSeconds(DURATION_MS.slow), ease: EASE.spring },
	sheetClose: { duration: 0.25, ease: EASE.in },
	expand: { duration: 0.25, ease: EASE.out },
} as const satisfies Record<string, Transition>
