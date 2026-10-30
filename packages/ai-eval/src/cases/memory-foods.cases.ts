// Saved foods (0.9.0): save_food from the words or a label, together with log_food (fromItemIndex),
// never unasked, an update only after «так»; and logging a saved food without an amount (usual
// portion, else one piece), by an inflected name, and the words of the user beating the memory.
// Clock: Wed 2026-10-07.
import type { MemoryFoodContext } from '@kus/shared'

import { NO_MEMORY_CALLS, range } from './case-builders.js'
import type { EvalCase } from './case.types.js'

const KABANOSY: MemoryFoodContext = {
	ref: 'm1',
	name: 'Кабаноси Tarczyński',
	aliases: ['кабаноси'],
	per100g: { kcal: 280, protein: 24, fat: 20, carbs: 2 },
	pieceGrams: 15,
	defaultGrams: 50,
	category: 'sausage',
}

const CHICKEN_CHIPS: MemoryFoodContext = {
	ref: 'm1',
	name: "Чіпси курячі в'ялені",
	aliases: [],
	per100g: { kcal: 380, protein: 60, fat: 12, carbs: 8 },
	pieceGrams: null,
	defaultGrams: null,
	category: 'snacks',
}

const KABANOSY_UPDATE_ASKED = [
	{ role: 'user' as const, content: "запам'ятай кабаноси 300 ккал на 100 г" },
	{
		role: 'assistant' as const,
		content: 'Кабаноси вже збережені: 280 ккал на 100 г. Оновити до 300 ккал?',
	},
]

export const MEMORY_FOOD_CASES: EvalCase[] = [
	{
		id: 'save-food-text',
		text: "запам'ятай кабаноси Tarczyński: 100 г — 280 ккал, Б 24, В 2, Ж 20, одна штука 15 г",
		expect: {
			decision: 'reply',
			memory: {
				foods: [
					{ nameIncludes: 'кабаноси', hasPer100g: true, pieceGrams: 15, fromItemIndex: null },
				],
				fact: null,
				forgets: [],
			},
		},
		reference:
			"An explicit «запам'ятай» with values: save_food with per100g and the piece, nothing logged",
	},
	{
		id: 'save-food-label-text',
		text: "запам'ятай кабаноси Tarczyński, з етикетки на 100 г: 280 ккал, білки 24 г, жири 20 г, вуглеводи 2 г",
		expect: {
			decision: 'reply',
			memory: { foods: [{ nameIncludes: 'кабаноси', hasPer100g: true }], fact: null, forgets: [] },
		},
		reference: 'The label numbers in words are the same as typed values: save_food, no log_food',
	},
	{
		id: 'save-food-with-log',
		text: "з'їв 2 кабаноси, 428 ккал на 100 г, штука 15 г, запам'ятай їх",
		expect: {
			decision: 'log_or_clarify',
			kcal: range(110, 150),
			maxItems: 1,
			memory: { foods: [{ fromItemIndex: 0 }], fact: null, forgets: [] },
		},
		reference:
			'Eaten and asked to remember: log_food (2 × 15 g at 428 per 100 g ≈ 128) + save_food from item 0',
	},
	{
		id: 'save-food-not-asked',
		text: "з'їв батончик SportyFeel",
		expect: { decision: 'log_or_clarify', memory: NO_MEMORY_CALLS },
		reference: 'A food is never saved unasked: log_food only',
	},
	{
		id: 'save-food-exists-diff',
		text: "запам'ятай кабаноси 300 ккал на 100 г",
		context: { memory: [KABANOSY] },
		expect: {
			decision: 'reply',
			replyIncludes: ['?'],
			memory: { foods: [], fact: null, forgets: [] },
		},
		reference:
			'Already saved with other values: ask whether to update, save nothing before the answer',
	},
	{
		id: 'save-food-update-yes',
		text: 'так',
		context: { memory: [KABANOSY], history: KABANOSY_UPDATE_ASKED },
		expect: {
			decision: 'reply',
			memory: { foods: [{ updateRef: 'm1', hasPer100g: true }], fact: null, forgets: [] },
		},
		reference: 'The user agreed to the update asked in the last turn: save_food with updateRef m1',
	},
	{
		id: 'memory-no-amount',
		text: 'додай кабаноси',
		context: { memory: [KABANOSY] },
		expect: {
			decision: 'log',
			memoryItems: [{ ref: 'm1', grams: 50 }],
			sources: ['MEMORY'],
		},
		reference:
			'A saved food without an amount: its usual portion (50 g), source MEMORY, no question',
	},
	{
		id: 'memory-no-amount-piece',
		text: 'додай кабаноси',
		context: { memory: [{ ...KABANOSY, defaultGrams: null }] },
		expect: {
			decision: 'log',
			memoryItems: [{ ref: 'm1', grams: 15 }],
			sources: ['MEMORY'],
		},
		reference: 'No usual portion, only a piece: one piece (15 g), no question',
	},
	{
		id: 'memory-inflection',
		text: 'ще тих самих кабаносів 2 штуки',
		context: { memory: [KABANOSY] },
		expect: {
			decision: 'log',
			memoryItems: [{ ref: 'm1', grams: 30 }],
			sources: ['MEMORY'],
		},
		reference:
			'The name in the genitive («кабаносів») is still the saved food: 2 pieces = 30 g, MEMORY',
	},
	{
		id: 'memory-words-win',
		text: 'кабаноси, але курячі',
		context: { memory: [KABANOSY] },
		expect: { decision: 'log_or_clarify', sources: ['REFERENCE', 'ESTIMATE'] },
		reference: 'Regression: «але курячі» is another food than the saved pork one, so not MEMORY',
	},
	{
		id: 'chicken-chips-memory',
		text: "з'їв 30 г курячих чіпсів",
		context: { memory: [CHICKEN_CHIPS] },
		expect: {
			decision: 'log',
			memoryItems: [{ ref: 'm1', grams: 30 }],
			sources: ['MEMORY'],
		},
		reference: 'An inflected name with a weight given: the saved food at 30 g, MEMORY, no question',
	},
]
