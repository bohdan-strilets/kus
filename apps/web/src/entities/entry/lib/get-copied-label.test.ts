import type { FoodEntryResponse } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { getCopiedLabel } from './get-copied-label'
import { toFoodEntryView } from './to-food-entry-view'

const t = i18n.t.bind(i18n)

// Monday
const TODAY = '2026-10-19'

describe('getCopiedLabel', () => {
	it('says «як учора» for yesterday', () => {
		expect(getCopiedLabel('2026-10-18', TODAY, t)).toBe('як учора')
	})

	it('names the weekday within the last week', () => {
		expect(getCopiedLabel('2026-10-16', TODAY, t)).toBe("як у п'ятницю")
		expect(getCopiedLabel('2026-10-13', TODAY, t)).toBe('як у вівторок')
	})

	it('falls back to the date further back', () => {
		expect(getCopiedLabel('2026-10-12', TODAY, t)).toBe('як 12.10')
	})

	it('has no label for today or a later day', () => {
		expect(getCopiedLabel(TODAY, TODAY, t)).toBeNull()
		expect(getCopiedLabel('2026-10-20', TODAY, t)).toBeNull()
	})
})

const entry: FoodEntryResponse = {
	id: '0199b3a4-0000-7000-8000-000000000010',
	name: 'Вівсянка на молоці',
	grams: 250,
	quantity: null,
	kcal: 255,
	protein: 9,
	fat: 8,
	carbs: 37,
	fiber: 4,
	category: 'porridge',
	source: 'MEMORY',
	confidence: 0.9,
	assumption: null,
	isEdited: false,
	copiedFromDate: null,
	isUndetailed: false,
}

describe('toFoodEntryView with a copied mark', () => {
	const plain = { isClarifying: false, answer: null }

	it('marks the entry «як учора» and keeps the amount', () => {
		const view = toFoodEntryView(entry, { ...plain, copiedLabel: 'як учора' }, t)
		expect(view.captionState).toBe('copied')
		expect(view.copiedLabel).toBe('як учора')
		expect(view.amount).toBe('250 г')
	})

	it('wins over «як завжди» when both fit', () => {
		expect(toFoodEntryView(entry, plain, t).captionState).toBe('usual')
		expect(toFoodEntryView(entry, { ...plain, copiedLabel: 'як учора' }, t).captionState).toBe(
			'copied',
		)
	})

	it('a drink reads in ml before the mark: «250 мл · як учора»', () => {
		const coffee: FoodEntryResponse = { ...entry, category: 'coffee', grams: 250 }
		const view = toFoodEntryView(coffee, { ...plain, copiedLabel: 'як учора' }, t)
		expect(view.amount).toBe('250 мл')
		expect(view.copiedLabel).toBe('як учора')
	})

	it('goes away once the entry is edited by hand', () => {
		const view = toFoodEntryView(
			{ ...entry, isEdited: true },
			{ ...plain, copiedLabel: 'як учора' },
			t,
		)
		expect(view.captionState).toBe('plain')
		expect(view.copiedLabel).toBeUndefined()
	})
})
