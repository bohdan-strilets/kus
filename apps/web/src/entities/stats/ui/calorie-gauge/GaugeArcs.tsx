import { useLayoutEffect, useRef } from 'react'

import {
	fillArc,
	RING_FILL_MS,
	RING_OVER_DELAY_MS,
	RING_OVER_MS,
	useRevealedValue,
} from '@/shared/lib'

import type { GaugeState } from '../../lib/get-gauge-state'
import { GAUGE_GEOMETRY, type GaugeSize, OVER_UNDERLAY_EXTRA } from './calorie-gauge.constants'

interface GaugeArcsProps {
	size: GaugeSize
	state: GaugeState
	/** Names the ring across mounts for useRevealedValue. */
	revealKey: string
}

/**
 * The track, the success arc and, over the goal, the second turn on its white underlay.
 * Animation (docs): success arc 700 ms → pause 120 → over arc 400 ms; reduced motion jumps to the end.
 * Only the first show per session and a changed value animate — then from the previous arc, not
 * from 0; a plain return to the tab draws the final state at once (useRevealedValue).
 */
export const GaugeArcs = ({ size, state, revealKey }: GaugeArcsProps) => {
	const { width, height, path, stroke } = GAUGE_GEOMETRY[size]
	const fillRef = useRef<SVGPathElement>(null)
	const underlayRef = useRef<SVGPathElement>(null)
	const overRef = useRef<SVGPathElement>(null)
	const isOver = state.overRatio > 0
	const fill = useRevealedValue(`${revealKey}:fill`, state.fillRatio)
	const over = useRevealedValue(`${revealKey}:over`, state.overRatio)

	// layout effect: the dasharray is set before paint, so the arc never flashes full
	useLayoutEffect(() => {
		if (fillRef.current) {
			void fillArc(fillRef.current, state.fillRatio, {
				fromRatio: fill.from,
				durationMs: fill.isAnimated ? RING_FILL_MS : 0,
			})
		}
		// the pause before the over arc only makes sense after a success arc that moved
		const overTiming = {
			fromRatio: over.from,
			durationMs: over.isAnimated ? RING_OVER_MS : 0,
			delayMs: fill.isAnimated ? RING_FILL_MS + RING_OVER_DELAY_MS : 0,
		}
		for (const arc of [underlayRef.current, overRef.current]) {
			if (arc) void fillArc(arc, state.overRatio, overTiming)
		}
	}, [state.fillRatio, state.overRatio, fill, over])

	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			fill="none"
			aria-hidden="true"
		>
			<path d={path} className="stroke-track" strokeWidth={stroke} strokeLinecap="round" />
			<path
				ref={fillRef}
				d={path}
				className="stroke-success"
				strokeWidth={stroke}
				strokeLinecap="round"
			/>
			{isOver && (
				<>
					<path
						ref={underlayRef}
						d={path}
						className="stroke-white"
						strokeWidth={stroke + OVER_UNDERLAY_EXTRA}
						strokeLinecap="round"
					/>
					<path
						ref={overRef}
						d={path}
						className="stroke-over"
						strokeWidth={stroke}
						strokeLinecap="round"
					/>
				</>
			)}
		</svg>
	)
}
