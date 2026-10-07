import { describe, expect, it } from 'vitest'

import { getMealTypeByHour } from './meal-type'

describe('getMealTypeByHour', () => {
	it.each([
		[3, 'SNACK'],
		[4, 'BREAKFAST'],
		[10, 'BREAKFAST'],
		[11, 'LUNCH'],
		[15, 'LUNCH'],
		[16, 'DINNER'],
		[21, 'DINNER'],
		[22, 'SNACK'],
		[0, 'SNACK'],
	])('hour %i → %s', (hour, type) => {
		expect(getMealTypeByHour(hour)).toBe(type)
	})
})
