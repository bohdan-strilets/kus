import { describe, expect, it } from 'vitest'

import { getRecapProteinKey } from './get-recap-protein-key'

describe('getRecapProteinKey', () => {
	it.each([
		[100, 140, 'chat.dayRecap.protein'],
		[131, 140, 'chat.dayRecap.proteinNearGoal'],
		[140, 140, 'chat.dayRecap.proteinAtGoal'],
		[160, 140, 'chat.dayRecap.proteinAtGoal'],
		[131, null, 'chat.dayRecap.proteinNoGoal'],
	])('protein %i of %s → %s', (protein, goal, key) => {
		expect(getRecapProteinKey(protein, goal)).toBe(key)
	})
})
