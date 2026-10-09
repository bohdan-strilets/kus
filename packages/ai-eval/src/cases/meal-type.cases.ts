// Which meal a message lands in. Added after a live bug: an evening message without a meal name
// joined the day's breakfast — the model copied the meal from the morning turns instead of leaving
// it to the clock.
import type { FoodParseContext } from '@kus/shared'

import { entry, range } from './case-builders.js'
import type { EvalCase } from './case.types.js'

/** The morning so far: breakfast logged at 05:17, nothing since; now it is evening. */
const EVENING_AFTER_BREAKFAST: Partial<FoodParseContext> = {
	localTime: '2026-10-09 19:30, Friday',
	dayTotals: { kcal: 482, protein: 24, fat: 16, carbs: 60 },
	meals: [{ type: 'BREAKFAST', kcal: 482 }],
	entries: [
		entry('e1', 'Вівсянка на воді', 'BREAKFAST', 250, 220, 'porridge'),
		entry('e2', 'Яйця варені', 'BREAKFAST', 100, 155, 'eggs'),
		entry('e3', 'Банан', 'BREAKFAST', 120, 107, 'banana'),
	],
	history: [
		{ role: 'user', content: 'на сніданок вівсянка на воді, 2 яйця і банан' },
		{ role: 'assistant', content: 'Записав сніданок. Смачного!' },
	],
}

export const MEAL_TYPE_CASES: EvalCase[] = [
	{
		id: 'meal-evening-after-breakfast',
		text: 'Рис сухий 80 г і свинина пісна тушкована 290 г',
		context: EVENING_AFTER_BREAKFAST,
		expect: {
			decision: 'log',
			kcal: range(640, 980),
			// no itemMeals: the right answer is mealType null (the backend's clock says DINNER), and the
			// eval compares the model's value as is — check `mealType` in results/ until it applies the clock
			categories: ['porridge', 'meat'],
		},
		reference:
			'The live bug: no meal named, 19:30 → the clock says DINNER, not the breakfast of the morning turns. Dry rice 80 g ≈ 280–300 kcal, lean stewed pork 290 g ≈ 360–680 kcal',
	},
	{
		id: 'meal-named-late-breakfast',
		text: 'на сніданок омлет з 2 яєць і скибка хліба',
		context: EVENING_AFTER_BREAKFAST,
		expect: {
			decision: 'log',
			kcal: range(220, 420),
			itemMeals: [
				{ stem: 'омлет', mealType: 'BREAKFAST' },
				{ stem: 'хліб', mealType: 'BREAKFAST' },
			],
			categories: ['eggs', 'bread'],
		},
		reference:
			'A meal named in this message wins over the clock: a breakfast logged in the evening stays breakfast. Omelette 150–280, bread 70–140',
	},
]
