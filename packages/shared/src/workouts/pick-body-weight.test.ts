import { describe, expect, it } from 'vitest'

import { pickBodyWeight } from './pick-body-weight.js'

describe('pickBodyWeight', () => {
	it('takes the weigh-in of the day itself', () => {
		const list = [
			{ localDate: '2026-10-30', value: 80 },
			{ localDate: '2026-11-01', value: 79 },
		]
		expect(pickBodyWeight(list, '2026-11-01')).toBe(79)
	})

	it('takes the latest one before the day, whatever the order', () => {
		const list = [
			{ localDate: '2026-10-20', value: 82 },
			{ localDate: '2026-10-28', value: 81 },
			{ localDate: '2026-10-25', value: 81.5 },
		]
		expect(pickBodyWeight(list, '2026-11-01')).toBe(81)
	})

	it('prefers a past weigh-in over a nearer future one', () => {
		const list = [
			{ localDate: '2026-11-02', value: 70 },
			{ localDate: '2026-10-01', value: 80 },
		]
		expect(pickBodyWeight(list, '2026-11-01')).toBe(80)
	})

	it('takes the first one after the day when none is before', () => {
		const list = [
			{ localDate: '2026-11-10', value: 78 },
			{ localDate: '2026-11-05', value: 79 },
			{ localDate: '2026-11-20', value: 77 },
		]
		expect(pickBodyWeight(list, '2026-11-01')).toBe(79)
	})

	it('is null without weigh-ins', () => {
		expect(pickBodyWeight([], '2026-11-01')).toBeNull()
	})
})
