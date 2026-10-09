import { loggedMealSchema } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { getMealCategory } from './get-meal-category'
import { formatEntryAmount, toFoodEntryView } from './to-food-entry-view'

const t = i18n.t.bind(i18n)

/** A breakfast exactly as POST /messages returns it (after the schema the client parses with). */
const breakfast = loggedMealSchema.parse({
	id: '0199b3a4-0000-7000-8000-000000000001',
	type: 'BREAKFAST',
	localDate: '2026-10-05',
	eatenAt: '2026-10-05T06:40:00.000Z',
	totals: { kcal: 370, protein: 23, fat: 17, carbs: 27, fiber: 3 },
	mealTotalKcal: null,
	entries: [
		{
			id: '0199b3a4-0000-7000-8000-000000000002',
			name: 'Яйця варені',
			grams: 150,
			quantity: 3,
			kcal: 215,
			protein: 19,
			fat: 15,
			carbs: 2,
			fiber: 0,
			category: 'eggs',
			source: 'REFERENCE',
			confidence: 0.9,
			assumption: null,
			isEdited: false,
		},
		{
			id: '0199b3a4-0000-7000-8000-000000000003',
			name: 'Гречка варена',
			grams: 100,
			quantity: null,
			kcal: 110,
			protein: 4,
			fat: 1,
			carbs: 21,
			fiber: 3,
			category: 'porridge',
			source: 'REFERENCE',
			confidence: 0.8,
			assumption: 'варена',
			isEdited: false,
		},
		{
			id: '0199b3a4-0000-7000-8000-000000000004',
			name: 'Кава з молоком 2,5%',
			grams: 250,
			quantity: null,
			kcal: 45,
			protein: 2,
			fat: 1,
			carbs: 4,
			fiber: null,
			category: 'coffee',
			source: 'MEMORY',
			confidence: 0.9,
			assumption: null,
			isEdited: false,
		},
	],
})

const [eggs, buckwheat, coffee] = breakfast.entries

describe('entries from the API', () => {
	it('give the meal the icon of its most caloric entry', () => {
		expect(getMealCategory(breakfast.entries)).toBe('eggs')
	})

	it('read the amount with pieces only when the user counted them', () => {
		if (!eggs || !buckwheat) throw new Error('fixture')
		expect(formatEntryAmount(eggs, t)).toBe('3 шт · 150 г')
		expect(formatEntryAmount(buckwheat, t)).toBe('100 г')
		expect(formatEntryAmount({ grams: 75, quantity: 1.5, category: 'pancakes' }, t)).toBe(
			'1,5 шт · 75 г',
		)
	})

	it('read drinks in ml: their grams hold the volume', () => {
		if (!coffee) throw new Error('fixture')
		expect(formatEntryAmount(coffee, t)).toBe('250 мл')
		expect(formatEntryAmount({ grams: 1000, quantity: 2, category: 'alcohol' }, t)).toBe(
			'2 шт · 1 000 мл',
		)
		expect(formatEntryAmount({ grams: 400, quantity: null, category: 'milk' }, t)).toBe('400 мл')
		// eaten with a spoon: grams
		expect(formatEntryAmount({ grams: 150, quantity: null, category: 'yogurt' }, t)).toBe('150 г')
	})

	it('caption a saved food, an open question and a tapped answer', () => {
		if (!buckwheat || !coffee) throw new Error('fixture')
		const plain = { isClarifying: false, answer: null }
		expect(toFoodEntryView(coffee, plain, t).captionState).toBe('usual')
		expect(toFoodEntryView(buckwheat, { isClarifying: true, answer: null }, t).captionState).toBe(
			'clarifying',
		)
		expect(toFoodEntryView(buckwheat, { isClarifying: false, answer: 'Суха' }, t)).toMatchObject({
			amount: '100 г · суха',
			captionState: 'plain',
			category: 'porridge',
		})
	})

	it('mark an entry changed in the chat, also after its question was answered', () => {
		if (!buckwheat) throw new Error('fixture')
		const edited = { ...buckwheat, grams: 250, isEdited: true }
		expect(toFoodEntryView(edited, { isClarifying: false, answer: null }, t).amount).toBe(
			'250 г · змінено',
		)
		expect(
			toFoodEntryView(edited, { isClarifying: false, answer: 'трішки більше' }, t).amount,
		).toBe('250 г · змінено')
	})
})
