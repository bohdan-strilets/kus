import { describe, expect, it } from 'vitest'

import {
	getJumpErrors,
	getMeasurementErrors,
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
})
