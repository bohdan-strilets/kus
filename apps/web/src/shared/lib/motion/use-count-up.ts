import { useEffect, useRef } from 'react'

import { countUp } from './motion.imperative'

interface UseCountUpOptions {
	durationMs?: number
	format?: (value: number) => string
	/** Start here instead of the value this hook showed last (useRevealedValue across mounts). */
	from?: number
	/** First-show start value (default 0): a card that was already on screen must not count up from 0. */
	initial?: number
}

/**
 * React wrapper around countUp(): counts the returned ref's element from the previous value to
 * `value`. Render the formatted final value as the element's text — that is the no-JS state.
 */
export const useCountUp = <T extends HTMLElement>(
	value: number,
	{ durationMs, format, from, initial }: UseCountUpOptions = {},
) => {
	const ref = useRef<T>(null)
	const previousValue = useRef(initial ?? 0)

	useEffect(() => {
		const element = ref.current
		const start = from ?? previousValue.current
		previousValue.current = value
		if (!element) return
		return countUp(element, start, value, { durationMs, format })
	}, [value, durationMs, format, from])

	return ref
}
