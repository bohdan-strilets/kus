import { describe, expect, it } from 'vitest'

import { getGaugeState } from './get-gauge-state'

// seed data and the four states of mockups/brand-calorie-ring-states.html, goal 2 200
const GOAL = 2200

describe('getGaugeState', () => {
	it('is under the goal with what is left (1 370 → 830 left)', () => {
		const state = getGaugeState(1370, GOAL)
		expect(state.status).toBe('under')
		expect(state.remaining).toBe(830)
		expect(state.fillRatio).toBeCloseTo(0.623, 3)
	})

	it('closes the goal inside 97–103 %', () => {
		expect(getGaugeState(2200, GOAL).status).toBe('closed')
		expect(getGaugeState(2134, GOAL).status).toBe('closed')
		expect(getGaugeState(2266, GOAL).status).toBe('closed')
		expect(getGaugeState(2133, GOAL).status).toBe('under')
	})

	it('goes over with a second turn proportional to the excess (2 380 → +180)', () => {
		const state = getGaugeState(2380, GOAL)
		expect(state.status).toBe('over')
		expect(state.over).toBe(180)
		expect(state.fillRatio).toBe(1)
		expect(state.overRatio).toBeCloseTo(0.0818, 3)
	})

	it('caps the second turn at half the arc (3 300 → +1 100)', () => {
		const state = getGaugeState(3300, GOAL)
		expect(state.over).toBe(1100)
		expect(state.overRatio).toBe(0.5)
	})

	it('stays empty without a goal or with nothing eaten', () => {
		expect(getGaugeState(500, 0).fillRatio).toBe(0)
		expect(getGaugeState(0, GOAL)).toMatchObject({ status: 'under', fillRatio: 0, remaining: GOAL })
	})

	it('treats a negative eaten as zero, so «left» never exceeds the goal', () => {
		expect(getGaugeState(-100, GOAL)).toMatchObject({ fillRatio: 0, remaining: GOAL })
	})
})
