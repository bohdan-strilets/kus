import { type RefObject, useEffect } from 'react'

import { isReducedMotion } from './motion.imperative'

const BLINK_CLASS = 'k-blink'
const BLINK_FIRST_DELAY_MS = 1500
const BLINK_MIN_INTERVAL_MS = 4000
const BLINK_JITTER_MS = 2000

interface UseBlinkOptions {
	isEnabled: boolean
}

/** Adds .k-blink to the hamster svg every 4–6 s; the blink itself is CSS in hamster.css. */
export const useBlink = (
	ref: RefObject<SVGSVGElement | null>,
	{ isEnabled }: UseBlinkOptions,
): void => {
	useEffect(() => {
		if (!isEnabled || isReducedMotion()) return
		let timer: ReturnType<typeof setTimeout>

		const tick = (): void => {
			const element = ref.current
			if (element) {
				element.classList.remove(BLINK_CLASS)
				// reading layout restarts the CSS animation
				void element.getBoundingClientRect()
				element.classList.add(BLINK_CLASS)
			}
			timer = setTimeout(tick, BLINK_MIN_INTERVAL_MS + Math.random() * BLINK_JITTER_MS)
		}

		timer = setTimeout(tick, BLINK_FIRST_DELAY_MS)
		return () => {
			clearTimeout(timer)
		}
	}, [ref, isEnabled])
}
