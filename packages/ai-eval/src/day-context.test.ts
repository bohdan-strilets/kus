import { describe, expect, it } from 'vitest'

import { buildDays } from './cases/case-builders.js'
import { BASE_CONTEXT } from './run-case.js'
import { withDayContext } from './day-context.js'

describe('withDayContext', () => {
	it('adds empty days around the case clock', () => {
		const { days } = withDayContext(BASE_CONTEXT)
		expect(days?.map((day) => day.localDate)).toEqual([
			'2026-10-04',
			'2026-10-05',
			'2026-10-06',
			'2026-10-07',
			'2026-10-08',
		])
		expect(days?.every((day) => day.entryCount === 0)).toBe(true)
	})

	it('keeps the days a case sets', () => {
		const days = buildDays('2026-10-07', { '2026-10-08': { kcal: 525, entryCount: 2 } })
		expect(withDayContext({ ...BASE_CONTEXT, days }).days).toBe(days)
	})

	it('lists weights and waist of the last 7 days as recent measurements, oldest first', () => {
		const { measurements } = withDayContext({
			...BASE_CONTEXT,
			measurements: {
				today: '2026-10-07',
				weights: [
					{ value: 82.4, localDate: '2026-10-06' },
					{ value: 83, localDate: '2026-09-20' },
					{ value: 82.9, localDate: '2026-10-02' },
				],
				waist: { value: 94, localDate: '2026-10-05' },
				targetWeightKg: null,
			},
		})
		expect(measurements.recent).toEqual([
			{ kind: 'WEIGHT', localDate: '2026-10-02', value: 82.9 },
			{ kind: 'WAIST', localDate: '2026-10-05', value: 94 },
			{ kind: 'WEIGHT', localDate: '2026-10-06', value: 82.4 },
		])
	})
})
