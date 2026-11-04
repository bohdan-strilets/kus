import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

import { liveRowReducedVariants, liveRowVariants, TRANSITION } from '@/shared/lib'

interface RowMotionProps {
	children: ReactNode
	/** Came after the list was on screen: grows in. A row that was there from the start shows at once. */
	isEntering: boolean
	/**
	 * The row slides out when removed (needs a stable key and an `AnimatePresence` above). Without
	 * it the row simply goes, and the neighbours glide into the gap.
	 */
	hasExit?: boolean
	/** How long the neighbours glide into a gap: `base` for a set, `slow` for an exercise. */
	glide?: 'base' | 'slow'
}

/**
 * design/docs/motion.md «Живий режим» п. 4: a row of a live list that is added or removed. The
 * neighbours move with `layout` (position only, so nothing stretches); the scrolling parent has to
 * be a `layoutScroll` one. Reduced motion: opacity only, no height, shift or layout.
 */
export const RowMotion = ({
	children,
	isEntering,
	hasExit = true,
	glide = 'base',
}: RowMotionProps) => {
	const isReduced = useReducedMotion() === true

	return (
		<motion.div
			layout={isReduced ? false : 'position'}
			variants={isReduced ? liveRowReducedVariants : liveRowVariants}
			initial={isEntering ? 'hidden' : false}
			animate="visible"
			exit={hasExit ? 'gone' : undefined}
			transition={{ layout: TRANSITION[glide] }}
		>
			{children}
		</motion.div>
	)
}
