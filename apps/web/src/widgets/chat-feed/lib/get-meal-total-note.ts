import type { LoggedMeal } from '@kus/shared'
import type { TFunction } from 'i18next'

import { getMealLabelKey } from '@/entities/entry'
import { formatInteger } from '@/shared/lib'

/**
 * «Вечеря разом: 917 ккал» under a card whose meal also holds food of other messages: the badge
 * counts only this message, so the whole meal is told apart. null — the card is the whole meal.
 */
export const getMealTotalNote = (
	{ type, mealTotalKcal }: Pick<LoggedMeal, 'type' | 'mealTotalKcal'>,
	t: TFunction,
): string | null =>
	mealTotalKcal === null
		? null
		: t('entry.mealTotal', { meal: t(getMealLabelKey(type)), kcal: formatInteger(mealTotalKcal) })
