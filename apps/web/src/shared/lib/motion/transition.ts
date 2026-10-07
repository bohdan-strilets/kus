import type { Transition } from 'motion/react'

/**
 * Kusik durations and curves, 1:1 with design/src/motion/motion.tokens.ts (tokens.json → motion).
 * With <MotionConfig reducedMotion="user"> at the root, variants respect reduced motion themselves.
 */
export const DURATION_MS = { fast: 120, base: 200, slow: 320, celebrateMax: 1000 } as const

type CubicBezier = [number, number, number, number]

export const EASE: Record<'out' | 'spring' | 'in', CubicBezier> = {
	/** everything that appears */
	out: [0.2, 0.8, 0.2, 1],
	/** lively feedback: badge, hamster, switch */
	spring: [0.34, 1.56, 0.64, 1],
	/** everything that disappears */
	in: [0.4, 0, 1, 1],
}

const toSeconds = (ms: number): number => ms / 1000

export const TRANSITION: Record<'fast' | 'base' | 'slow' | 'expand' | 'pop' | 'exit', Transition> =
	{
		fast: { duration: toSeconds(DURATION_MS.fast), ease: EASE.out },
		base: { duration: toSeconds(DURATION_MS.base), ease: EASE.out },
		slow: { duration: toSeconds(DURATION_MS.slow), ease: EASE.out },
		/** clarification and other blocks that open by height (design/docs/motion.md: 250 ms) */
		expand: { duration: 0.25, ease: EASE.out },
		pop: { duration: 0.3, ease: EASE.spring },
		exit: { duration: 0.25, ease: EASE.in },
	}

/** Press on a button / option / chip: spread onto a motion element. */
export const PRESS = { whileTap: { scale: 0.96 }, transition: TRANSITION.fast }

/** Calorie ring: 700 ms fill; when over goal — 120 ms pause, then the over arc for 400 ms. */
export const RING_FILL_MS = 700
export const RING_OVER_DELAY_MS = 120
export const RING_OVER_MS = 400

/** Macro bars: 600 ms, delay 120 + i·80. */
export const BAR_FILL_MS = 600
export const BAR_DELAY_MS = 120
export const BAR_STEP_MS = 80
