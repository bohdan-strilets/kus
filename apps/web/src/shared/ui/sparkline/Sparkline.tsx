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
const REFERENCE_WIDTH = 1.5
const REFERENCE_DASH = '4 4'

const toPercent = (part: number, whole: number): string => `${(part / whole) * 100}%`

/**
 * A small trend chart in plain SVG (docs Charts, design/mockups/chat-weight.html): success line
 * over a 10 % success fill. It stretches to the width of its box; the stroke does not. A lone
 * point is an HTML dot over the SVG: inside the stretched SVG it would be squashed into an oval.
 */
export const Sparkline = ({ values, label, reference, className }: SparklineProps) => {
	if (values.length === 0) return null
	const { line, area, points, referenceY } = getSparklinePaths(values, reference)
	const [single] = points

	return (
		<div className={cn('relative h-16 w-full', className)}>
			<svg
				role="img"
				aria-label={label}
				viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
				preserveAspectRatio="none"
				className="size-full"
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
			</svg>
			{!line && single && (
				<span
					aria-hidden="true"
					data-sparkline-dot=""
					className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-success"
					style={{
						left: toPercent(single.x, SPARKLINE_WIDTH),
						top: toPercent(single.y, SPARKLINE_HEIGHT),
					}}
				/>
			)}
		</div>
	)
}
