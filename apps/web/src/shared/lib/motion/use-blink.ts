import { useReducedMotion } from 'motion/react'
import { type RefObject, useEffect } from 'react'

const BLINK_CLASS = 'k-blink'
const FIRST_BLINK_MS = 1500
const BLINK_INTERVAL_MIN_MS = 4000
const BLINK_INTERVAL_JITTER_MS = 2000

/** Adds .k-blink to the hamster svg every 4–6 s (the CSS lives in shared/ui/hamster). */
export const useBlink = (ref: RefObject<SVGSVGElement | null>, isEnabled: boolean): void => {
	const shouldReduceMotion = useReducedMotion()

	useEffect(() => {
		if (!isEnabled || shouldReduceMotion) return
		let timer: ReturnType<typeof setTimeout>
		const tick = (): void => {
			const element = ref.current
			if (element) {
				element.classList.remove(BLINK_CLASS)
				// forces a reflow so the CSS animation restarts
				void element.getBoundingClientRect()
				element.classList.add(BLINK_CLASS)
			}
			timer = setTimeout(tick, BLINK_INTERVAL_MIN_MS + Math.random() * BLINK_INTERVAL_JITTER_MS)
		}
		timer = setTimeout(tick, FIRST_BLINK_MS)
		return () => {
			clearTimeout(timer)
		}
	}, [ref, isEnabled, shouldReduceMotion])
}
