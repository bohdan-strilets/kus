// Which tool the model picks: not_food (claims to have eaten something inedible), reply
// (conversation), clarify (logged + a question that changes kcal by 80+ and 15 %+).
import { entry, range } from './case-builders.js'
import type { EvalCase } from './case.types.js'

/** 1240 eaten of 2000 — the backend gives the model the remainder, the model must not add up. */
const DAY_WITH_GOAL: EvalCase['context'] = {
	dayTotals: { kcal: 1240, protein: 70, fat: 45, carbs: 140 },
	meals: [
		{ type: 'BREAKFAST', kcal: 420 },
		{ type: 'LUNCH', kcal: 820 },
	],
	entries: [
		entry('e1', 'Вівсянка на молоці', 'BREAKFAST', 300, 330, 'porridge'),
		entry('e2', 'Кава з молоком', 'BREAKFAST', 250, 90, 'coffee'),
		entry('e3', 'Борщ', 'LUNCH', 350, 175, 'borscht'),
		entry('e4', 'Котлета', 'LUNCH', 120, 300, 'meat'),
		entry('e5', 'Картопляне пюре', 'LUNCH', 250, 345, 'potatoes'),
	],
	goal: { dailyKcal: 2000, protein: 140, fat: 70, carbs: 200, remainingKcal: 760 },
}

/** Over the goal by 300 kcal. */
const DAY_OVER_GOAL: EvalCase['context'] = {
	dayTotals: { kcal: 2300, protein: 100, fat: 90, carbs: 260 },
	meals: [
		{ type: 'BREAKFAST', kcal: 600 },
		{ type: 'LUNCH', kcal: 900 },
		{ type: 'DINNER', kcal: 800 },
	],
	entries: [
		entry('e1', 'Омлет з сиром', 'BREAKFAST', 250, 600, 'eggs'),
		entry('e2', 'Паста з куркою', 'LUNCH', 400, 900, 'pasta'),
		entry('e3', 'Піца', 'DINNER', 300, 800, 'fast_food'),
	],
	goal: { dailyKcal: 2000, protein: 140, fat: 70, carbs: 200, remainingKcal: -300 },
}

/** A feast is one honest estimate; no lecture, no «tomorrow eat less». */
const NO_LECTURE = ['забагато', 'завтра менше', 'компенс', 'обережн', 'варто']

export const DECISION_CASES: EvalCase[] = [
	{
		id: 'not-food-stone',
		text: "з'їв камінь",
		expect: { decision: 'not_food' },
		reference: 'Inedible → not_food, nothing logged',
	},
	{
		id: 'not-food-phone',
		text: "з'їв телефон",
		expect: { decision: 'not_food' },
		reference: 'Inedible → not_food, nothing logged',
	},
	{
		id: 'not-food-nails',
		text: "на обід з'їв жменю цвяхів",
		expect: { decision: 'not_food' },
		reference: 'Inedible even with a meal named',
	},
	{
		id: 'reply-water',
		text: 'випив склянку води',
		expect: { decision: 'reply' },
		reference: 'Plain water has no kcal → a short reply, nothing logged',
	},
	{
		id: 'reply-mineral-water',
		text: 'пляшка мінералки 0,5',
		expect: { decision: 'reply' },
		reference: 'Mineral water with nothing added → reply, nothing logged',
	},
	{
		id: 'log-water-and-banana',
		text: "випив склянку води і з'їв банан",
		expect: { decision: 'log', kcal: range(85, 125), categories: ['banana'] },
		reference: 'Water is skipped, the banana is still logged (~105 kcal per 120 g edible, USDA)',
	},
	{
		id: 'log-tea-no-sugar',
		text: 'чашка зеленого чаю без цукру',
		expect: { decision: 'log', kcal: range(0, 10), categories: ['tea'] },
		reference: 'Tea without sugar is still logged (~2 kcal per 250 ml, USDA)',
	},
	{
		id: 'odd-pork-wings',
		text: 'свинячі крильця',
		expect: {
			decision: 'clarify',
			kcal: range(150, 900),
			clarifyRenames: true,
		},
		reference:
			'Pigs have no wings: log the likely chicken wings and ask chicken wings vs pork ribs, each named',
	},
	{
		id: 'odd-close-options',
		text: "з'їв 150 г рибних крилець",
		expect: {
			decision: 'clarify',
			kcal: range(150, 500),
			clarifyRenames: true,
		},
		reference:
			'Fish have no wings: chicken wings (~320) vs fish fingers (~290) are close in kcal, yet a rename question is kept without the threshold',
	},
	{
		id: 'odd-fried-ice',
		text: 'смажений лід',
		expect: { decision: 'reply' },
		reference: 'Nothing plausible to log → reply asking what it was, no invented values',
	},
	{
		id: 'odd-air-cutlet',
		text: 'котлета з повітря',
		expect: { decision: 'reply' },
		reference: 'Nothing plausible to log → reply asking what it was, no invented values',
	},
	{
		id: 'reply-hello',
		text: 'привіт',
		expect: { decision: 'reply' },
		reference: 'Greeting → reply',
	},
	{
		id: 'reply-thanks',
		text: 'дякую!',
		expect: { decision: 'reply' },
		reference: 'Thanks → reply',
	},
	{
		id: 'reply-remaining',
		text: 'скільки мені ще можна?',
		context: DAY_WITH_GOAL,
		expect: { decision: 'reply', replyIncludes: ['760'] },
		reference: 'Remaining from the context (2000 − 1240 = 760), not computed by the model',
	},
	{
		id: 'reply-remaining-no-goal',
		text: 'скільки ще можна сьогодні?',
		expect: { decision: 'reply' },
		reference: 'No goal → reply, suggest setting one',
	},
	{
		id: 'reply-plan',
		text: 'ввечері піду на піцу, що порадиш?',
		context: DAY_WITH_GOAL,
		expect: { decision: 'reply' },
		reference: 'A plan, not a meal yet → reply, nothing logged',
	},
	{
		id: 'clarify-soup',
		text: 'тарілка супу',
		expect: { decision: 'clarify', kcal: range(100, 400), categories: ['soup'] },
		reference:
			'Type and size unknown: veg soup ~150 vs kharcho/solyanka ~350 → clarify, log a best guess',
	},
	{
		id: 'clarify-buckwheat',
		text: '100 г гречки',
		expect: { decision: 'clarify', kcal: range(92, 132), categories: ['porridge'] },
		reference: 'Cooked ~110 vs dry ~343 kcal (mockup chat-clarify); logged as cooked',
	},
	{
		id: 'clarify-pasta',
		text: '80 г макаронів',
		expect: { decision: 'clarify', kcal: range(120, 300), categories: ['pasta'] },
		reference: 'Cooked ~126 vs dry ~297 kcal (USDA) → clarify',
	},
	{
		id: 'feast-wedding',
		text: 'був на весіллі, їв усього потроху',
		expect: {
			decision: 'log',
			maxItems: 1,
			kcal: range(1500, 2500),
			replyExcludes: NO_LECTURE,
		},
		reference:
			'A wedding feast: one item with a feast-sized estimate (1500–2500 kcal), assumption stated, no made-up menu and no moralising',
	},
	{
		id: 'feast-with-wine',
		text: 'застілля в родичів, ще 3 келихи вина',
		expect: { decision: 'log', maxItems: 2, kcal: range(1400, 2400) },
		reference:
			'The feast (~1200–1800) and 3 glasses of wine (3 × 120–150 ml × ~85 kcal per 125 ml): at most two items',
	},
	{
		id: 'feast-with-number',
		text: 'вчора було застілля, десь 4000',
		expect: {
			decision: 'log',
			logDate: '2026-10-06',
			maxItems: 1,
			kcal: range(3900, 4100),
			replyExcludes: NO_LECTURE,
		},
		reference: "The user's own number (4000 kcal) is taken as it is, for yesterday, as one item",
	},
	{
		id: 'feast-over-goal-no-lecture',
		text: 'день народження у друга, застілля',
		context: DAY_OVER_GOAL,
		expect: { decision: 'log', kcal: range(1500, 2500), replyExcludes: NO_LECTURE },
		reference:
			'Already 300 over the goal: the feast is still logged honestly, without a reminder of the goal or advice',
	},
]
