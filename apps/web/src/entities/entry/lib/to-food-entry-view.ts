import type { FoodEntryResponse, MealType } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatDecimal, formatInteger, INTL_LOCALE } from '@/shared/lib'

import type { EntryCaptionState, FoodEntryView } from '../model/entry.types'

const MEAL_LABEL_KEY = {
	BREAKFAST: 'meal.breakfast',
	LUNCH: 'meal.lunch',
	SNACK: 'meal.snack',
	DINNER: 'meal.dinner',
	OTHER: 'meal.other',
} as const satisfies Record<MealType, string>

export const getMealLabelKey = (type: MealType): (typeof MEAL_LABEL_KEY)[MealType] =>
	MEAL_LABEL_KEY[type]

/** «3 шт · 150 г» when the user counted pieces, else «150 г». */
export const formatEntryAmount = (
	{ grams, quantity }: Pick<FoodEntryResponse, 'grams' | 'quantity'>,
	t: TFunction,
): string => {
	const gramsText = formatInteger(grams)
	return quantity === null
		? t('entry.amountGrams', { grams: gramsText })
		: t('entry.amountPieces', {
				count: Number.isInteger(quantity) ? formatInteger(quantity) : formatDecimal(quantity),
				grams: gramsText,
			})
}

interface EntryViewOptions {
	/** An open clarification asks about this entry: «100 г · уточнюємо». */
	isClarifying: boolean
	/** The answer of a closed clarification, tapped or in words: «100 г · суха». */
	answer: string | null
}

/** An API entry as a food line in the chat card. A saved food reads «як завжди». */
export const toFoodEntryView = (
	entry: FoodEntryResponse,
	{ isClarifying, answer }: EntryViewOptions,
	t: TFunction,
): FoodEntryView => {
	const amount = formatEntryAmount(entry, t)
	const getCaption = (): { amount: string; captionState: EntryCaptionState } => {
		if (isClarifying) return { amount, captionState: 'clarifying' }
		if (answer !== null) {
			const answerText = answer.toLocaleLowerCase(INTL_LOCALE)
			return {
				amount: t('entry.answeredCaption', { amount, answer: answerText }),
				captionState: 'plain',
			}
		}
		if (entry.isEdited) {
			return { amount: t('entry.editedCaption', { amount }), captionState: 'plain' }
		}
		if (entry.source === 'MEMORY') return { amount, captionState: 'usual' }
		return { amount, captionState: 'plain' }
	}
	return {
		id: entry.id,
		name: entry.name,
		kcal: entry.kcal,
		category: entry.category,
		...getCaption(),
	}
}
