// Weight and waist from the chat (stage 8): log_measurement next to a reply (or log_food), a fix of the
// same day, "yesterday", implausible numbers, a jump that needs the user's word, and a bare number that
// answers a question. The server catches a jump on its own — here only the model's behaviour is judged.
import type { FoodParseContext } from '@kus/shared'

import { entry, EVAL_TODAY, range } from './case-builders.js'
import type { EvalCase } from './case.types.js'

/** BASE_CONTEXT clock: Wednesday 2026-10-07. */
const YESTERDAY = '2026-10-06'
const TWO_DAYS_AGO = '2026-10-05'

const LAST_WEIGHT_TWO_DAYS_AGO: Partial<FoodParseContext> = {
	measurements: {
		today: EVAL_TODAY,
		weights: [{ value: 82, localDate: TWO_DAYS_AGO }],
		waist: null,
		targetWeightKg: null,
	},
}

/** 82.4 was just logged today: «ні, 82,6» fixes it. */
const JUST_WEIGHED: Partial<FoodParseContext> = {
	measurements: {
		today: EVAL_TODAY,
		weights: [{ value: 82.4, localDate: EVAL_TODAY }],
		waist: null,
		targetWeightKg: null,
	},
	history: [
		{ role: 'user', content: '82,4' },
		{ role: 'assistant', content: 'Записав вагу.' },
	],
}

/** Kusik asked whether 87 is right after 82 two days ago; the user answers next. */
const JUMP_ASKED: Partial<FoodParseContext> = {
	...LAST_WEIGHT_TWO_DAYS_AGO,
	history: [
		{ role: 'user', content: '87' },
		{ role: 'assistant', content: 'Це на 5 кг більше, ніж 82 кг два дні тому. Точно 87?' },
	],
}

/** The author's case: Kusik asked for the portion of a logged food; «150» is the answer, not a weight. */
const PORTION_ASKED: Partial<FoodParseContext> = {
	dayTotals: { kcal: 96, protein: 16, fat: 0.5, carbs: 5 },
	meals: [{ type: 'SNACK', kcal: 96 }],
	entries: [
		entry('e1', 'Скир натуральний', 'SNACK', 100, 96, 'yogurt', {
			protein: 16,
			fat: 0.5,
			carbs: 5,
		}),
	],
	history: [
		{ role: 'user', content: 'скир' },
		{
			role: 'assistant',
			content: 'Записав скир, порцію оцінив на 100 г. Скільки грамів було насправді?',
		},
	],
}

const ASKS_A_QUESTION = ['?']

/** A weigh-in reply is a warm sentence without numbers: the card shows them. */
const NO_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

export const MEASUREMENT_CASES: EvalCase[] = [
	{
		id: 'weight-bare-number',
		text: '82,4',
		expect: {
			decision: 'reply',
			replyExcludes: NO_DIGITS,
			measurements: [{ kind: 'WEIGHT', value: 82.4 }],
		},
		reference:
			'A bare number in 30–300 after no question is weight in kg; one reply next to the log',
	},
	{
		id: 'weight-with-unit',
		text: 'важу 82.4 кг',
		expect: {
			decision: 'reply',
			replyExcludes: NO_DIGITS,
			measurements: [{ kind: 'WEIGHT', value: 82.4 }],
		},
		reference: 'Dot decimal and the unit are read as 82.4 kg',
	},
	{
		id: 'weight-with-word',
		text: 'вага 82,4',
		expect: {
			decision: 'reply',
			replyExcludes: NO_DIGITS,
			measurements: [{ kind: 'WEIGHT', value: 82.4 }],
		},
		reference: 'Comma decimal after the word «вага»',
	},
	{
		id: 'waist-cm',
		text: 'талія 94 см',
		expect: {
			decision: 'reply',
			replyExcludes: NO_DIGITS,
			measurements: [{ kind: 'WAIST', value: 94 }],
		},
		reference: 'Waist in cm',
	},
	{
		id: 'weight-and-waist',
		text: 'вага 82,4 і талія 94',
		expect: {
			decision: 'reply',
			replyExcludes: NO_DIGITS,
			measurements: [
				{ kind: 'WEIGHT', value: 82.4 },
				{ kind: 'WAIST', value: 94 },
			],
		},
		reference: 'Both kinds in one message: one log_measurement each, one reply',
	},
	{
		id: 'weight-fix-same-day',
		text: 'ні, 82,6',
		context: JUST_WEIGHED,
		expect: {
			decision: 'reply',
			replyExcludes: NO_DIGITS,
			measurements: [{ kind: 'WEIGHT', value: 82.6 }],
		},
		reference:
			'A fix is log_measurement again for the same day (today); the new value replaces 82.4',
	},
	{
		id: 'weight-yesterday',
		text: 'вчора важив 83',
		expect: {
			decision: 'reply',
			replyExcludes: NO_DIGITS,
			measurements: [{ kind: 'WEIGHT', value: 83, date: YESTERDAY }],
		},
		reference: '«Вчора» is the context date minus one day, within the 7-day backdate limit',
	},
	{
		id: 'weight-implausible-hundreds',
		text: 'вага 820',
		expect: { decision: 'reply', measurements: [] },
		reference: '820 kg is outside 30–300: nothing logged, the reply asks to check the number',
	},
	{
		id: 'weight-implausible-decimal-slip',
		text: 'вага 8,24',
		expect: { decision: 'reply', measurements: [] },
		reference: '8.24 kg is outside 30–300 (a slipped comma): nothing logged, ask to check',
	},
	{
		id: 'waist-implausible',
		text: 'талія 20 см',
		expect: { decision: 'reply', measurements: [] },
		reference: '20 cm is outside 40–200: nothing logged, ask to check',
	},
	{
		id: 'weight-jump-bare',
		text: '87',
		context: LAST_WEIGHT_TWO_DAYS_AGO,
		expect: { decision: 'reply', replyIncludes: ASKS_A_QUESTION, measurements: [] },
		reference: '82 → 87 in 2 days is above 3 kg: no log, a reply asks whether the number is right',
	},
	{
		id: 'weight-jump-with-word',
		text: 'вага 87',
		context: LAST_WEIGHT_TWO_DAYS_AGO,
		expect: { decision: 'reply', replyIncludes: ASKS_A_QUESTION, measurements: [] },
		reference: 'Same jump with the word «вага»: still asks, never confirmedJump on the first try',
	},
	{
		id: 'weight-jump-confirmed',
		text: 'так, 87',
		context: JUMP_ASKED,
		expect: {
			decision: 'reply',
			replyExcludes: NO_DIGITS,
			measurements: [{ kind: 'WEIGHT', value: 87, confirmedJump: true }],
		},
		reference: 'The user confirmed the jump in a later message: logged with confirmedJump true',
	},
	{
		id: 'weight-small-change',
		text: '83.5',
		context: LAST_WEIGHT_TWO_DAYS_AGO,
		expect: {
			decision: 'reply',
			replyExcludes: NO_DIGITS,
			measurements: [{ kind: 'WEIGHT', value: 83.5 }],
		},
		reference: '82 → 83.5 is 1.5 kg, within 3 kg: logged without a question',
	},
	{
		id: 'weight-with-food',
		text: "з'їв 2 яйця, вага 82,4",
		expect: {
			decision: 'log_or_clarify',
			categories: ['eggs'],
			kcal: range(120, 220),
			measurements: [{ kind: 'WEIGHT', value: 82.4 }],
		},
		reference: '2 eggs ≈ 140 kcal (+ cooking fat), log_food and log_measurement in one turn',
	},
	{
		id: 'weight-question',
		text: 'скільки я важу?',
		context: {
			measurements: {
				today: EVAL_TODAY,
				weights: [{ value: 82.4, localDate: EVAL_TODAY }],
				waist: null,
				targetWeightKg: null,
			},
		},
		expect: { decision: 'reply', replyIncludes: ['82'], measurements: [] },
		reference: 'A question about the weight is answered from the context; nothing is logged',
	},
	{
		id: 'bare-number-answers-portion',
		text: '150',
		context: PORTION_ASKED,
		expect: {
			decision: 'edit',
			edits: { corrected: [{ ref: 'e1', grams: range(150, 150) }] },
			measurements: [],
		},
		reference:
			'After a question about grams a bare number answers it: the skyr portion becomes 150 g, never a weight of 150 kg',
	},
]
