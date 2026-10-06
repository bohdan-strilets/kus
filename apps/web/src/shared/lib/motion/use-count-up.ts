import { useEffect, useRef } from 'react'

import { countUp } from './motion.imperative'

interface UseCountUpOptions {
	durationMs?: number
	format?: (value: number) => string
}

/**
 * React wrapper around countUp(): counts the returned ref's element from the previous value to
 * `value`. Render the formatted final value as the element's text — that is the no-JS state.
 */
export const useCountUp = <T extends HTMLElement>(
	value: number,
	{ durationMs, format }: UseCountUpOptions = {},
) => {
	const ref = useRef<T>(null)
	const previousValue = useRef(0)

	useEffect(() => {
		const element = ref.current
		const from = previousValue.current
		previousValue.current = value
		if (!element) return
		return countUp(element, from, value, { durationMs, format })
	}, [value, durationMs, format])

	return ref
}
