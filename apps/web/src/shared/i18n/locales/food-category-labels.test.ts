import { FOOD_CATEGORIES } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import uk from './uk.json'

// The enum in packages/shared is the source; every category needs a label in each locale
describe('food.category labels', () => {
	it('has a Ukrainian label for every category and nothing extra', () => {
		expect(Object.keys(uk.food.category).sort()).toEqual([...FOOD_CATEGORIES].sort())
	})
})
