import { describe, expect, it } from 'vitest'

import { normalizeExerciseName } from './exercise-name.js'

describe('normalizeExerciseName', () => {
	it('ignores case, punctuation and spacing', () => {
		expect(normalizeExerciseName('  Жим   лежачи. ')).toBe('жим лежачи')
	})

	it('keeps a name of symbols only, so such names do not collapse into one row', () => {
		expect(normalizeExerciseName('🏋️')).toBe('🏋️')
		expect(normalizeExerciseName('!!!')).toBe('!!!')
		expect(normalizeExerciseName('  ')).toBe('')
	})
})
