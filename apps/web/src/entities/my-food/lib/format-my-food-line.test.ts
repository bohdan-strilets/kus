import type { MyFoodResponse } from '@kus/shared'
import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { formatMyFoodLine } from './format-my-food-line'

const t = i18n.t.bind(i18n) as TFunction

const food: MyFoodResponse = {
	id: '0199b3a4-0000-7000-8000-000000000001',
	name: 'Кабаноси',
	brand: null,
	aliases: [],
	per100g: { kcal: 280, protein: 24, fat: 20, carbs: 2, fiber: null },
	pieceGrams: null,
	defaultGrams: null,
	category: 'eggs',
	source: 'MANUAL',
	updatedAt: '2026-10-30T10:00:00.000Z',
}

describe('formatMyFoodLine', () => {
	it('shows only the kcal when there is no piece and no portion', () => {
		expect(formatMyFoodLine(food, t)).toBe('100 г — 280 ккал')
	})

	it('adds «1 шт = …» for a piece', () => {
		expect(formatMyFoodLine({ ...food, pieceGrams: 15 }, t)).toBe('100 г — 280 ккал · 1 шт = 15 г')
	})

	it('adds the portion when there is no piece; the piece wins when both are set', () => {
		expect(formatMyFoodLine({ ...food, defaultGrams: 150 }, t)).toBe(
			'100 г — 280 ккал · порція 150 г',
		)
		expect(formatMyFoodLine({ ...food, pieceGrams: 15, defaultGrams: 30 }, t)).toBe(
			'100 г — 280 ккал · 1 шт = 15 г',
		)
	})
})
