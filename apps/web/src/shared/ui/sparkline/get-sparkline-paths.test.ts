import { describe, expect, it } from 'vitest'

import { getSparklinePaths, SPARKLINE_HEIGHT } from './get-sparkline-paths'

describe('getSparklinePaths', () => {
	it('reproduces the path of mockups/chat-weight.html for its five weights', () => {
		const { line, area } = getSparklinePaths([84, 83.7, 83.2, 82.9, 82.4])

		expect(line).toBe('M10.0 11.2 L72.5 19.0 L135.0 32.0 L197.5 39.8 L260.0 52.8')
		expect(area).toBe(`${line} L260.0 ${SPARKLINE_HEIGHT} L10.0 ${SPARKLINE_HEIGHT} Z`)
	})

	it('puts a higher value higher on the chart', () => {
		const { points } = getSparklinePaths([80, 90])

		expect(points[0]?.y).toBeGreaterThan(points[1]?.y ?? 0)
	})

	it('runs a flat series through the middle', () => {
		const { points } = getSparklinePaths([82, 82, 82])

		expect(points.map((point) => point.y)).toEqual([32, 32, 32])
	})

	it('has a dot at the right edge but no line for a single point', () => {
		const { line, area, points } = getSparklinePaths([82.4])

		expect(line).toBeNull()
		expect(area).toBeNull()
		expect(points).toEqual([{ x: 260, y: 32 }])
	})

	it('draws a reference near the data and stretches the chart to it', () => {
		const { referenceY, points } = getSparklinePaths([84, 83, 82], 81)

		expect(referenceY).not.toBeNull()
		expect(referenceY ?? 0).toBeGreaterThan(points[2]?.y ?? 0)
	})

	it('hides a reference far from the data and leaves the points as they were', () => {
		const withFar = getSparklinePaths([84, 83, 82], 70)

		expect(withFar.referenceY).toBeNull()
		expect(withFar.line).toBe(getSparklinePaths([84, 83, 82]).line)
	})

	it('has no reference for a flat series or a single point', () => {
		expect(getSparklinePaths([82, 82], 81).referenceY).toBeNull()
		expect(getSparklinePaths([82], 81).referenceY).toBeNull()
	})
})
