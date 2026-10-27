// Ready day states by name: a JSON case (private, hold-out) can't build a context in code,
// so it names one of these in `contextPreset`. Values are made up, never real meals.
import type { FoodParseContext } from '@kus/shared'

import { atClock, entry } from './case-builders.js'

/** 1240 eaten of 2000 — the backend gives the model the remainder, the model must not add up. */
export const DAY_WITH_GOAL: Partial<FoodParseContext> = {
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
export const DAY_OVER_GOAL: Partial<FoodParseContext> = {
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

/** Nothing eaten yet, a goal of 2000. */
const MORNING_EMPTY: Partial<FoodParseContext> = {
	...atClock('2026-10-07 08:10, Wednesday'),
	goal: { dailyKcal: 2000, protein: 140, fat: 70, carbs: 200, remainingKcal: 2000 },
}

/** Evening, 400 kcal left of 2000: «що на вечерю?», «скільки ще можна?». */
const EVENING_1600_OF_2000: Partial<FoodParseContext> = {
	...atClock('2026-10-07 19:30, Wednesday'),
	dayTotals: { kcal: 1600, protein: 95, fat: 55, carbs: 180 },
	meals: [
		{ type: 'BREAKFAST', kcal: 420 },
		{ type: 'LUNCH', kcal: 820 },
		{ type: 'SNACK', kcal: 360 },
	],
	entries: [
		...(DAY_WITH_GOAL.entries ?? []),
		entry('e6', 'Йогурт з гранолою', 'SNACK', 200, 360, 'yogurt'),
	],
	goal: { dailyKcal: 2000, protein: 140, fat: 70, carbs: 200, remainingKcal: 400 },
}

export const CONTEXT_PRESETS = {
	'morning-empty': MORNING_EMPTY,
	'midday-1240-of-2000': DAY_WITH_GOAL,
	'evening-1600-of-2000': EVENING_1600_OF_2000,
	'evening-over-goal': { ...atClock('2026-10-07 21:00, Wednesday'), ...DAY_OVER_GOAL },
} as const satisfies Record<string, Partial<FoodParseContext>>

export type ContextPresetName = keyof typeof CONTEXT_PRESETS

export const CONTEXT_PRESET_NAMES = Object.keys(CONTEXT_PRESETS) as [
	ContextPresetName,
	...ContextPresetName[],
]
