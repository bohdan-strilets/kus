import type { MyFoodResponse } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatInteger } from '@/shared/lib'

/** «100 г — 280 ккал · 1 шт = 15 г», or «· порція 150 г» when there is no piece, or just the first part. */
export const formatMyFoodLine = (food: MyFoodResponse, t: TFunction): string => {
	const kcal = formatInteger(food.per100g.kcal)
	if (food.pieceGrams !== null) {
		return t('myFood.linePiece', { kcal, grams: formatInteger(food.pieceGrams) })
	}
	if (food.defaultGrams !== null) {
		return t('myFood.lineServing', { kcal, grams: formatInteger(food.defaultGrams) })
	}
	return t('myFood.line', { kcal })
}
