import type { AchievementResponse } from '@kus/shared'
import i18n from 'i18next'
import { describe, expect, it } from 'vitest'

import '@/shared/i18n'

import { getAchievementPhrase } from './get-achievement-phrase'

const create = (type: AchievementResponse['type'], value: number): AchievementResponse => ({
	id: '0199b3a4-0000-7000-8000-000000000031',
	type,
	value,
	achievedAt: '2026-10-12T10:00:00.000Z',
})

const phrase = (type: AchievementResponse['type'], value: number): string =>
	getAchievementPhrase(create(type, value), i18n.t)

describe('getAchievementPhrase', () => {
	it('kilograms: the same warm line for any number', () => {
		expect(phrase('WEIGHT_KG_LOST', 2)).toBe('Ще одна ціла цифра позаду. Далі — у своєму темпі.')
	})

	it('a week: the mockup line with the next mark', () => {
		expect(phrase('FOOD_STREAK', 7)).toBe(
			'Тиждень поспіль із записами. Наступна позначка — 14 днів.',
		)
	})

	it('the last mark has no next one', () => {
		expect(phrase('FOOD_STREAK', 100)).toBe('Сто днів із записами.')
	})

	it('a value off the marks still names the next mark', () => {
		expect(phrase('FOOD_STREAK', 5)).toBe('Наступна позначка — 7 днів.')
	})
})
