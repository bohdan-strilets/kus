import { describe, expect, it } from 'vitest'

import {
	getJumpErrors,
	getMeasurementErrors,
	roundMeasurementValue,
	type MeasurementPoint,
	type MeasurementRefs,
} from './measurements.js'
import type { LogMeasurementInput } from './tools.js'

const refs: MeasurementRefs = { today: '2026-10-07' }

const PREVIOUS: MeasurementPoint = { value: 82.8, localDate: '2026-10-05' }

const weight = (value: number, extra: Partial<LogMeasurementInput> = {}): LogMeasurementInput => ({
	kind: 'WEIGHT',
	value,
	date: null,
	confirmedJump: false,
	...extra,
})

const waist = (value: number, extra: Partial<LogMeasurementInput> = {}): LogMeasurementInput => ({
	...weight(value),
	kind: 'WAIST',
	...extra,
})

const errorsOf = (inputs: LogMeasurementInput[]) => getMeasurementErrors(inputs, refs)

describe('getMeasurementErrors', () => {
	it('accepts a plain weigh-in', () => {
		expect(errorsOf([weight(82.4), waist(94)])).toEqual([])
	})

	it('checks the range edges of weight', () => {
		expect(errorsOf([weight(30)])).toEqual([])
		expect(errorsOf([weight(300)])).toEqual([])
		expect(errorsOf([weight(29.9)])).toHaveLength(1)
		expect(errorsOf([weight(300.1)])).toHaveLength(1)
	})

	it('checks the range edges of waist', () => {
		expect(errorsOf([waist(40)])).toEqual([])
		expect(errorsOf([waist(200)])).toEqual([])
		expect(errorsOf([waist(39.9)])).toHaveLength(1)
		expect(errorsOf([waist(200.1)])).toHaveLength(1)
	})

	describe('date', () => {
		it('accepts a day within a week back and today', () => {
			expect(errorsOf([weight(82.5, { date: '2026-09-30' })])).toEqual([])
			expect(errorsOf([weight(82.5, { date: '2026-10-07' })])).toEqual([])
		})

		it('rejects tomorrow', () => {
			expect(errorsOf([weight(82.5, { date: '2026-10-08' })])[0]).toContain('future')
		})

		it('rejects 8 days back', () => {
			expect(errorsOf([weight(82.5, { date: '2026-09-29' })])[0]).toContain('days back')
		})
	})

	describe('one value per kind', () => {
		it('rejects two weights', () => {
			expect(errorsOf([weight(82.4), weight(82.6)])[0]).toContain('more than one WEIGHT')
		})

		it('rejects two waists', () => {
			expect(errorsOf([waist(94), waist(93)])[0]).toContain('more than one WAIST')
		})
	})
})

describe('getJumpErrors', () => {
	const jumpOf = (input: LogMeasurementInput, previous: MeasurementPoint | null = PREVIOUS) =>
		getJumpErrors(input, previous, refs.today)

	it('lets exactly 3.0 kg pass', () => {
		expect(jumpOf(weight(85.8))).toEqual([])
		expect(jumpOf(weight(79.8))).toEqual([])
	})

	it('catches 3.1 kg with a hint to ask the user', () => {
		const [error] = jumpOf(weight(85.9))
		expect(error).toBe(
			'log_measurement: 85.9 kg differs by 3.1 kg from 82.8 on 2026-10-05 — do not log; ask the user to confirm with reply',
		)
	})

	it('catches a drop as well', () => {
		expect(jumpOf(weight(79.7))).toHaveLength(1)
	})

	it('has nothing to compare with when there is no previous weight', () => {
		expect(jumpOf(weight(120), null)).toEqual([])
	})

	it('compares only with weights up to 7 days back', () => {
		expect(jumpOf(weight(90), { value: 82.8, localDate: '2026-09-30' })).toHaveLength(1)
		expect(jumpOf(weight(90), { value: 82.8, localDate: '2026-09-29' })).toEqual([])
	})

	it('measures the window from the day of the measurement', () => {
		const backdated = weight(90, { date: '2026-10-02' })
		expect(jumpOf(backdated, { value: 82.8, localDate: '2026-09-24' })).toEqual([])
		expect(jumpOf(backdated, { value: 82.8, localDate: '2026-09-25' })).toHaveLength(1)
	})

	it('ignores a weight that is not before the day', () => {
		expect(jumpOf(weight(90), { value: 82.8, localDate: '2026-10-07' })).toEqual([])
	})

	it('skips the check after the user confirmed', () => {
		expect(jumpOf(weight(87, { confirmedJump: true }))).toEqual([])
	})

	it('does not apply to waist', () => {
		expect(jumpOf(waist(120))).toEqual([])
	})

	describe('a big jump from the last weight of any age', () => {
		const OLD: MeasurementPoint = { value: 80, localDate: '2026-07-01' }

		it('lets exactly 15.0 kg pass and catches 15.1 kg', () => {
			expect(jumpOf(weight(95), OLD)).toEqual([])
			expect(jumpOf(weight(65), OLD)).toEqual([])
			expect(jumpOf(weight(95.1), OLD)).toHaveLength(1)
			expect(jumpOf(weight(64.9), OLD)).toHaveLength(1)
		})

		it('asks what the number is, with the difference and the date', () => {
			expect(jumpOf(weight(96), OLD)).toEqual([
				'log_measurement: 96 kg differs by 16.0 kg from 80 on 2026-07-01 — do not log; ask the user what this number is, or to confirm it, with reply',
			])
		})

		it('does not flag a smaller change of an old weight', () => {
			expect(jumpOf(weight(90), OLD)).toEqual([])
		})

		it('catches it for a recent weight too, with one error only', () => {
			expect(jumpOf(weight(100), PREVIOUS)).toHaveLength(1)
		})

		it('is skipped after the user confirmed', () => {
			expect(jumpOf(weight(96, { confirmedJump: true }), OLD)).toEqual([])
		})

		it('has nothing to compare with when there is no previous weight', () => {
			expect(jumpOf(weight(250), null)).toEqual([])
		})
	})
})

describe('roundMeasurementValue', () => {
	it.each([
		[70.05, 70.1],
		[82.45, 82.5],
		[82.44, 82.4],
		[82.449, 82.4],
		[29.96, 30],
		[300.04, 300],
		[300.05, 300.1],
		[-70.05, -70.1],
		[0, 0],
		[65.25, 65.3],
		[99.95, 100],
		[82, 82],
	])('rounds %s to %s', (value, expected) => {
		expect(roundMeasurementValue(value)).toBe(expected)
	})

	describe('values with an exponent or not finite', () => {
		it('rounds 1e-7 and 1.5e-7 down to zero', () => {
			expect(Object.is(roundMeasurementValue(1e-7), 0)).toBe(true)
			expect(Object.is(roundMeasurementValue(1.5e-7), 0)).toBe(true)
		})

		it('rounds -1e-7 to a zero of either sign', () => {
			expect(roundMeasurementValue(-1e-7)).toBeCloseTo(0, 10)
		})

		it('keeps 1e21 as it is', () => {
			expect(roundMeasurementValue(1e21)).toBe(1e21)
		})

		it('passes NaN and the infinities through', () => {
			expect(roundMeasurementValue(Number.NaN)).toBeNaN()
			expect(roundMeasurementValue(Infinity)).toBe(Infinity)
			expect(roundMeasurementValue(-Infinity)).toBe(-Infinity)
		})
	})
})
