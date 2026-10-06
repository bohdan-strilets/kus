import { animate } from 'motion'

import { formatInteger } from '../format'
import { EASE, RING_FILL_MS } from './transition'

/** Imperative Motion animations for the SVG ring and numbers, where variants are awkward. */

export const isReducedMotion = (): boolean =>
	window.matchMedia('(prefers-reduced-motion: reduce)').matches

const COUNT_DEFAULT_MS = 500

interface CountUpOptions {
	durationMs?: number
	format?: (value: number) => string
}

/** Number counter (kcal, kg), ease-out, uk-UA format «1 370». Returns a stop function. */
export const countUp = (
	element: Element,
	from: number,
	to: number,
	{ durationMs = COUNT_DEFAULT_MS, format = formatInteger }: CountUpOptions = {},
): (() => void) => {
	if (isReducedMotion()) {
		element.textContent = format(to)
		return () => undefined
	}
	const controls = animate(from, to, {
		duration: durationMs / 1000,
		ease: EASE.out,
		onUpdate: (latest) => {
			element.textContent = format(latest)
		},
	})
	return () => {
		controls.stop()
	}
}

interface FillArcOptions {
	fromRatio?: number
	durationMs?: number
	delayMs?: number
}

const clampRatio = (ratio: number): number => Math.min(1, Math.max(0, ratio))

/**
 * Fills an arc via stroke-dashoffset. The length comes from getTotalLength(), so it works for
 * the «Сьогодні» half circle (170×96) and the chat header one (112×70) alike.
 */
export const fillArc = async (
	path: SVGPathElement,
	ratio: number,
	{ fromRatio = 0, durationMs = RING_FILL_MS, delayMs = 0 }: FillArcOptions = {},
): Promise<void> => {
	const length = path.getTotalLength()
	path.style.strokeDasharray = `${length} ${length}`
	const target = length * (1 - clampRatio(ratio))
	if (isReducedMotion()) {
		path.style.strokeDashoffset = String(target)
		return
	}
	const start = length * (1 - fromRatio)
	await animate(
		path,
		{ strokeDashoffset: [start, target] },
		{ duration: durationMs / 1000, delay: delayMs / 1000, ease: EASE.out },
	)
}
