import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'

import { formatInteger } from '../format'
import { EASE } from './transition'

interface CountUpOptions {
	durationMs?: number
	format?: (value: number) => string
}

const DEFAULT_COUNT_UP_MS = 500

/**
 * Counts the number in the returned ref's element from the previous value to `value`.
 * Render `format(value)` as the element's text: that is the final state without JS or motion.
 */
export const useCountUp = <T extends HTMLElement>(
	value: number,
	{ durationMs = DEFAULT_COUNT_UP_MS, format = formatInteger }: CountUpOptions = {},
) => {
	const ref = useRef<T>(null)
	const previousValue = useRef(0)
	const shouldReduceMotion = useReducedMotion()

	useEffect(() => {
		const element = ref.current
		const from = previousValue.current
		previousValue.current = value
		if (!element) return
		if (shouldReduceMotion) {
			element.textContent = format(value)
			return
		}
		const controls = animate(from, value, {
			duration: durationMs / 1000,
			ease: EASE.outCubic,
			onUpdate: (latest) => {
				element.textContent = format(latest)
			},
		})
		return () => {
			controls.stop()
		}
	}, [value, durationMs, format, shouldReduceMotion])

	return ref
}
