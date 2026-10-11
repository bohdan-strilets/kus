import { useEffect, useState } from 'react'

/** What every ring and bar last showed in this page session; module state, gone with the tab. */
const shownValues = new Map<string, number>()

export interface RevealedValue {
	/** Where the animation starts: 0 on the first show, the last shown value afterwards. */
	from: number
	/** False when the same value is already known from an earlier show: jump to it, no animation. */
	isAnimated: boolean
}

const getInitialReveal = (key: string | null, value: number): RevealedValue => {
	const previous = key === null ? undefined : shownValues.get(key)
	if (previous === undefined) return { from: 0, isAnimated: true }
	return { from: previous, isAnimated: previous !== value }
}

/**
 * design/docs/motion.md → Дані: the ring and the bars animate on the first show per session and
 * when the value changes (from the previous value, not from 0) — never on a plain return to the
 * tab. `key` names the element across mounts; null turns the memory off (always from 0).
 * The result changes only with `value`, so it is safe in effect dependencies.
 */
export const useRevealedValue = (key: string | null, value: number): RevealedValue => {
	const [reveal, setReveal] = useState<RevealedValue>(() => getInitialReveal(key, value))
	// adjust during render: a new value while mounted animates from the one on screen
	const [shownValue, setShownValue] = useState(value)
	if (shownValue !== value) {
		setShownValue(value)
		setReveal({ from: shownValue, isAnimated: true })
	}

	useEffect(() => {
		if (key !== null) shownValues.set(key, value)
	}, [key, value])

	return reveal
}

/** Tests only: forget everything shown so far. */
export const resetRevealedValues = (): void => {
	shownValues.clear()
}
