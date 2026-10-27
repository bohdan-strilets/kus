import { describe, expect, it } from 'vitest'

import { toValuesBefore } from './entry-values-before'

describe('toValuesBefore', () => {
	it('with one change per field gives only the value before it', () => {
		const result = toValuesBefore([{ foodEntryId: 'a', before: { grams: 80, kcal: 150 } }])

		expect(result.get('a')).toEqual({ grams: 80, kcal: 150 })
	})

	it('with several changes of a field gives the latest «before» and the first one as originally', () => {
		const result = toValuesBefore([
			{ foodEntryId: 'a', before: { grams: 80, kcal: 150 } },
			{ foodEntryId: 'a', before: { grams: 100, protein: 9 } },
		])

		expect(result.get('a')).toEqual({
			grams: 100,
			kcal: 150,
			protein: 9,
			originally: { grams: 80 },
		})
	})

	it('does not repeat originally when the field came back to its first value', () => {
		const result = toValuesBefore([
			{ foodEntryId: 'a', before: { grams: 80 } },
			{ foodEntryId: 'a', before: { grams: 80 } },
		])

		expect(result.get('a')).toEqual({ grams: 80 })
	})

	it('keeps entries apart and reads a name and a meal move', () => {
		const result = toValuesBefore([
			{ foodEntryId: 'a', before: { name: 'Суп' } },
			{ foodEntryId: 'b', before: { mealType: 'DINNER' } },
		])

		expect(result.get('a')).toEqual({ name: 'Суп' })
		expect(result.get('b')).toEqual({ mealType: 'DINNER' })
	})

	it('skips deletions, restores, unknown meals and malformed rows', () => {
		const result = toValuesBefore([
			{ foodEntryId: 'a', before: { deleted: false } },
			{ foodEntryId: 'b', before: { mealType: 'BRUNCH' } },
			{ foodEntryId: 'c', before: null },
			{ foodEntryId: 'd', before: [1, 2] },
			{ foodEntryId: 'e', before: { grams: '100' } },
		])

		expect(result.size).toBe(0)
	})
})
