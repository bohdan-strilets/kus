import { cn } from '@/shared/lib'

import { getSparklinePaths, SPARKLINE_HEIGHT, SPARKLINE_WIDTH } from './get-sparkline-paths'

export interface SparklineProps {
	/** Oldest first. Nothing to draw for an empty list. */
	values: readonly number[]
	/** Accessible name (translated by the caller): the chart says what it shows in words. */
	label: string
	/** The goal: a dashed line, when it is close enough to the data to share the chart. */
	reference?: number
	className?: string
}

const LINE_WIDTH = 2.5
const DOT_RADIUS = 3.5
const REFERENCE_WIDTH = 1.5
const REFERENCE_DASH = '4 4'

/**
 * A small trend chart in plain SVG (docs Charts, design/mockups/chat-weight.html): success line
 * over a 10 % success fill. It stretches to the width of its box; the stroke does not.
 */
export const Sparkline = ({ values, label, reference, className }: SparklineProps) => {
	if (values.length === 0) return null
	const { line, area, points, referenceY } = getSparklinePaths(values, reference)
	const [single] = points

	return (
		<svg
			role="img"
			aria-label={label}
			viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
			preserveAspectRatio="none"
			className={cn('h-16 w-full', className)}
		>
			{referenceY !== null && (
				<line
					x1={0}
					x2={SPARKLINE_WIDTH}
					y1={referenceY}
					y2={referenceY}
					strokeWidth={REFERENCE_WIDTH}
					strokeDasharray={REFERENCE_DASH}
					vectorEffect="non-scaling-stroke"
					className="stroke-muted-soft"
				/>
			)}
			{area && <path d={area} className="fill-success/10" />}
			{line && (
				<path
					d={line}
					fill="none"
					strokeWidth={LINE_WIDTH}
					strokeLinecap="round"
					strokeLinejoin="round"
					vectorEffect="non-scaling-stroke"
					className="stroke-success"
				/>
			)}
			{!line && single && (
				<circle cx={single.x} cy={single.y} r={DOT_RADIUS} className="fill-success" />
			)}
		</svg>
	)
}
