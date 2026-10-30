import type { MyFoodResponse, UpdateMyFoodRequest } from '@kus/shared'

import {
	type EditMyFoodInput,
	type EditMyFoodValues,
	getPortionGrams,
} from '../model/edit-my-food.schema'

const HUNDREDTHS = 100

type FullUpdateRequest = Required<UpdateMyFoodRequest>

/** 12.5 → «12,5»: the way a number is typed in the field. */
export const formatInputNumber = (value: number): string =>
	String(Math.round(value * HUNDREDTHS) / HUNDREDTHS).replace('.', ',')

const formatOptional = (value: number | null): string =>
	value === null ? '' : formatInputNumber(value)

/** With «1 шт» the portion is shown in pieces (mockup: «2 шт»), otherwise in grams. */
export const toFormValues = (food: MyFoodResponse): EditMyFoodInput => ({
	name: food.name,
	kcal: formatInputNumber(food.per100g.kcal),
	protein: formatInputNumber(food.per100g.protein),
	carbs: formatInputNumber(food.per100g.carbs),
	fat: formatInputNumber(food.per100g.fat),
	pieceGrams: formatOptional(food.pieceGrams),
	portion: formatOptional(
		food.defaultGrams !== null && food.pieceGrams !== null
			? food.defaultGrams / food.pieceGrams
			: food.defaultGrams,
	),
})

interface BuildRequestOptions {
	/** The portion or «1 шт =» was edited; otherwise the saved grams stay as they are, not re-rounded from pieces. */
	isPortionTouched: boolean
}

export const buildUpdateRequest = (
	values: EditMyFoodValues,
	food: MyFoodResponse,
	{ isPortionTouched }: BuildRequestOptions,
): FullUpdateRequest => {
	const portionGrams =
		values.portion === null ? null : getPortionGrams(values.portion, values.pieceGrams)
	return {
		name: values.name,
		per100g: {
			kcal: values.kcal,
			protein: values.protein,
			fat: values.fat,
			carbs: values.carbs,
			fiber: food.per100g.fiber,
		},
		pieceGrams: values.pieceGrams,
		defaultGrams: isPortionTouched ? portionGrams : food.defaultGrams,
	}
}

/** Nothing to send: the sheet just closes. */
export const isSameAsFood = (request: FullUpdateRequest, food: MyFoodResponse): boolean =>
	request.name === food.name &&
	request.per100g.kcal === food.per100g.kcal &&
	request.per100g.protein === food.per100g.protein &&
	request.per100g.fat === food.per100g.fat &&
	request.per100g.carbs === food.per100g.carbs &&
	request.pieceGrams === food.pieceGrams &&
	request.defaultGrams === food.defaultGrams
