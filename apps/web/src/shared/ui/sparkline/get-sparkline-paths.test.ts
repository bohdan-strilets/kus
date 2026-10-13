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
})
