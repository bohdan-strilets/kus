export const SPARKLINE_WIDTH = 270
export const SPARKLINE_HEIGHT = 64

/** Margins of the plot inside the viewBox, from design/mockups/chat-weight.html. */
const PAD_X = 10
const PAD_Y = 11.2

export interface SparklinePaths {
	/** The polyline; null for fewer than two points — a single point has no line. */
	line: string | null
	/** The line closed down to the baseline, for the fill. */
	area: string | null
	/** Where the points sit, in viewBox units. */
	points: readonly { x: number; y: number }[]
}

const toCoords = ({ x, y }: { x: number; y: number }): string => `${x.toFixed(1)} ${y.toFixed(1)}`

/**
 * Evenly spaced points, higher value higher on the chart. A single point sits at the right edge
 * (the latest value); a flat series runs through the middle.
 */
export const getSparklinePaths = (values: readonly number[]): SparklinePaths => {
	const min = Math.min(...values)
	const max = Math.max(...values)
	const span = max - min
	const lastIndex = values.length - 1
	const points = values.map((value, index) => ({
		x:
			lastIndex === 0
				? SPARKLINE_WIDTH - PAD_X
				: PAD_X + (index * (SPARKLINE_WIDTH - 2 * PAD_X)) / lastIndex,
		y:
			span === 0
				? SPARKLINE_HEIGHT / 2
				: PAD_Y + ((max - value) / span) * (SPARKLINE_HEIGHT - 2 * PAD_Y),
	}))
	const first = points[0]
	const last = points[lastIndex]
	if (!first || !last || points.length < 2) return { line: null, area: null, points }
	const line = points
		.map((point, index) => `${index === 0 ? 'M' : 'L'}${toCoords(point)}`)
		.join(' ')
	const area = `${line} L${last.x.toFixed(1)} ${SPARKLINE_HEIGHT} L${first.x.toFixed(1)} ${SPARKLINE_HEIGHT} Z`
	return { line, area, points }
}
