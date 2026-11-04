import { animate, motion, usePresence, useReducedMotion } from 'motion/react'
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { liveContentVariants, scrimVariants, TRANSITION } from '@/shared/lib'

const STRIP_SELECTOR = '[data-mini-strip]'
/** The strip's own corner (rounded-button) → the surface's: design/docs/motion.md «Живий режим» п. 1. */
const STRIP_CLIP_RADIUS_PX = 24
const FULL_CLIP = 'inset(0px round 0px)'

const hasStrip = (): boolean => document.querySelector(STRIP_SELECTOR) !== null

/** `clip-path` that is exactly the strip, in the surface's own coordinates; null without a strip. */
const getStripClip = (surface: HTMLElement): string | null => {
	const strip = document.querySelector(STRIP_SELECTOR)
	if (!strip) return null
	const from = strip.getBoundingClientRect()
	const box = surface.getBoundingClientRect()
	const top = from.top - box.top
	const right = box.right - from.right
	const bottom = box.bottom - from.bottom
	const left = from.left - box.left
	return `inset(${top}px ${right}px ${bottom}px ${left}px round ${STRIP_CLIP_RADIUS_PX}px)`
}

/**
 * The live screen over a tab, unfolding from the mini strip (design/docs/motion.md «Живий режим»
 * п. 1): one surface whose `clip-path` grows from the strip's rectangle to the full screen (slow,
 * ease-out) and shrinks back the same way (ease-in). The tab and its bottom nav stay under it, so
 * nothing jumps. The bottom inset is the screen's own: its rest panel reaches the edge. With reduced motion, or with no strip to grow from (a deep link, a fresh start),
 * the surface only fades.
 */
export const LiveSurface = ({ children }: { children: ReactNode }) => {
	const surfaceRef = useRef<HTMLDivElement>(null)
	const isReduced = useReducedMotion() === true
	const [isPresent, safeToRemove] = usePresence()
	// read once, at the first render: the strip is still there while the screen opens
	const [isGrowing] = useState(() => !isReduced && hasStrip())

	useLayoutEffect(() => {
		const surface = surfaceRef.current
		if (!surface) return undefined
		const from = isGrowing ? getStripClip(surface) : null
		if (from === null) {
			surface.style.opacity = '0'
			const fade = animate(surface, { opacity: [0, 1] }, TRANSITION.base)
			return () => {
				fade.stop()
			}
		}
		surface.style.clipPath = from
		const unfold = animate(surface, { clipPath: [from, FULL_CLIP] }, TRANSITION.slow)
		return () => {
			unfold.stop()
		}
	}, [isGrowing])

	useEffect(() => {
		if (isPresent) return undefined
		const surface = surfaceRef.current
		const to = surface && !isReduced ? getStripClip(surface) : null
		if (!surface) {
			safeToRemove()
			return undefined
		}
		const fold =
			to === null
				? animate(surface, { opacity: [1, 0] }, TRANSITION.exit)
				: animate(surface, { clipPath: [FULL_CLIP, to] }, TRANSITION.exit)
		void fold.then(() => {
			safeToRemove()
		})
		return () => {
			fold.stop()
		}
	}, [isPresent, isReduced, safeToRemove])

	return (
		<div className="absolute inset-0 z-40">
			<motion.div
				variants={scrimVariants}
				initial="hidden"
				animate="visible"
				exit="hidden"
				className="absolute inset-0 bg-ink/25"
			/>
			<div
				ref={surfaceRef}
				className="absolute inset-0 flex flex-col overflow-hidden bg-app pt-safe-top"
			>
				{isGrowing && (
					<motion.div
						aria-hidden="true"
						initial={{ opacity: 1 }}
						animate={{ opacity: 0 }}
						transition={TRANSITION.fast}
						className="pointer-events-none absolute inset-0 z-10 bg-ink"
					/>
				)}
				<motion.div
					variants={liveContentVariants}
					initial="hidden"
					animate="visible"
					exit="gone"
					className="flex min-h-0 flex-1 flex-col"
				>
					{children}
				</motion.div>
			</div>
		</div>
	)
}
