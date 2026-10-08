import type { GaugeState } from '../../lib/get-gauge-state'

const RADIUS = 9
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const STROKE_WIDTH = 3.2
/** The white underlay that lifts the over turn off the full success ring, as in the big gauge. */
const MINI_OVER_UNDERLAY_EXTRA = 1.6

interface ArcProps {
	length: number
	className: string
	width: number
}

// From 12 o'clock, clockwise
const Arc = ({ length, className, width }: ArcProps) => (
	<circle
		cx="12"
		cy="12"
		r={RADIUS}
		className={className}
		strokeWidth={width}
		strokeLinecap="round"
		strokeDasharray={`${length} ${CIRCUMFERENCE}`}
		transform="rotate(-90 12 12)"
	/>
)

/**
 * The 26px progress ring of the collapsed chat header (mockups/chat-compact.html). Over the goal it
 * draws the same second turn in `over` as the big CalorieGauge, so 2 482 / 2 200 never looks closed.
 */
export const MiniRing = ({ state }: { state: GaugeState }) => {
	const filled = state.fillRatio * CIRCUMFERENCE
	const over = state.overRatio * CIRCUMFERENCE

	return (
		<svg
			width="26"
			height="26"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
			className="shrink-0"
		>
			<circle cx="12" cy="12" r={RADIUS} className="stroke-track" strokeWidth={STROKE_WIDTH} />
			{/* a round cap would draw a dot at zero */}
			{filled > 0 && <Arc length={filled} className="stroke-success" width={STROKE_WIDTH} />}
			{over > 0 && (
				<>
					<Arc
						length={over}
						className="stroke-white"
						width={STROKE_WIDTH + MINI_OVER_UNDERLAY_EXTRA}
					/>
					<Arc length={over} className="stroke-over" width={STROKE_WIDTH} />
				</>
			)}
		</svg>
	)
}
