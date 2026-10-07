const RADIUS = 9
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const STROKE_WIDTH = 3.2

/** The 26px progress ring of the collapsed chat header (mockups/chat-compact.html). */
export const MiniRing = ({ ratio }: { ratio: number }) => {
	const filled = Math.min(1, Math.max(0, ratio)) * CIRCUMFERENCE

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
			<circle
				cx="12"
				cy="12"
				r={RADIUS}
				className="stroke-success"
				strokeWidth={STROKE_WIDTH}
				strokeLinecap="round"
				strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
				transform="rotate(-90 12 12)"
			/>
		</svg>
	)
}
