const SIZE = 84
const STROKE = 6
const CENTER = SIZE / 2
const RADIUS = CENTER - STROKE / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const END_DOT_RADIUS = 4

interface RestRingProps {
	/** 0..1: how much of the rest is left; the arc shrinks as the time goes. */
	fraction: number
	isEnded: boolean
	label: string
	time: string
}

/** The ring of the rest timer (mockups/training-rest.html): 84, an arc of `success-on-dark` on a dim track. */
export const RestRing = ({ fraction, isEnded, label, time }: RestRingProps) => (
	<div role="timer" aria-label={label} className="relative size-21 flex-none">
		<svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
			<circle
				cx={CENTER}
				cy={CENTER}
				r={RADIUS}
				fill="none"
				strokeWidth={STROKE}
				className="stroke-white/14"
			/>
			{isEnded ? (
				<circle cx={CENTER} cy={STROKE / 2} r={END_DOT_RADIUS} className="fill-success-on-dark" />
			) : (
				<circle
					cx={CENTER}
					cy={CENTER}
					r={RADIUS}
					fill="none"
					strokeWidth={STROKE}
					strokeLinecap="round"
					strokeDasharray={CIRCUMFERENCE}
					strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
					transform={`rotate(-90 ${CENTER} ${CENTER})`}
					className="stroke-success-on-dark"
				/>
			)}
		</svg>
		<span
			aria-hidden="true"
			className="absolute inset-0 flex items-center justify-center text-stat font-extrabold text-white tabular-nums"
		>
			{time}
		</span>
	</div>
)
