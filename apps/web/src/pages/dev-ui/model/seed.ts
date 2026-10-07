import type { CategorizedEntry, MacroAmounts } from '@/entities/entry'
import type { MacroProgressSet, WeekDay } from '@/entities/stats'

/** Seed numbers agreed across the mockups (design/docs/screens.md). Strings live in uk.dev.json. */

export const SEED_GOAL_KCAL = 2200
export const SEED_EATEN_KCAL = 1370
/** today-over: dinner pushed the day 180 over the goal. */
export const SEED_OVER_EATEN_KCAL = 2380
/** brand-calorie-ring-states «Сильно понад». */
export const SEED_FAR_OVER_EATEN_KCAL = 3300

export const SEED_MACROS: MacroProgressSet = {
	protein: { value: 78, goal: 140 },
	carbs: { value: 160, goal: 225 },
	fat: { value: 48, goal: 80 },
}

export const SEED_OVER_MACROS: MacroProgressSet = {
	protein: { value: 132, goal: 140 },
	carbs: { value: 250, goal: 225 },
	fat: { value: 86, goal: 80 },
}

export const SEED_BREAKFAST = {
	time: '08:40',
	kcal: 370,
	macros: { protein: 23, carbs: 27, fat: 17 } satisfies MacroAmounts,
	eggsKcal: 215,
	buckwheatKcal: 110,
	coffeeKcal: 45,
}

export const SEED_CLARIFY = { boiledKcal: 110, dryKcal: 343 }

export const SEED_RECIPE = { kcal: 540, proteinGrams: 52 }

/**
 * The «Сьогодні» meals. Entries carry a category so the row icon comes from getMealCategory
 * (the most caloric entry); the split inside lunch and snack is made up, the totals are the mockup's.
 */
export const SEED_MEALS = {
	breakfast: {
		time: '08:40',
		kcal: 370,
		entries: [
			{ category: 'eggs', kcal: 215 },
			{ category: 'porridge', kcal: 110 },
			{ category: 'coffee', kcal: 45 },
		],
	},
	lunch: {
		time: '13:15',
		kcal: 620,
		entries: [
			{ category: 'soup', kcal: 340 },
			{ category: 'bread', kcal: 160 },
			{ category: 'salad', kcal: 120 },
		],
	},
	snack: {
		time: '16:30',
		kcal: 380,
		entries: [
			{ category: 'cottage_cheese', kcal: 280 },
			{ category: 'banana', kcal: 100 },
		],
	},
	dinner: { time: '19:40', kcal: 1010, entries: [{ category: 'pizza', kcal: 1010 }] },
} as const satisfies Record<
	string,
	{ time: string; kcal: number; entries: readonly CategorizedEntry[] }
>

/** Monday 5 October 2026, the day every mockup shows. */
export const SEED_TODAY = new Date(2026, 9, 5)

/** Вт 29 … Пн 5: dots from mockups/today.html (30 and 3 over the goal). */
export const SEED_WEEK: readonly WeekDay[] = [
	{ date: new Date(2026, 8, 29), status: 'normal' },
	{ date: new Date(2026, 8, 30), status: 'over' },
	{ date: new Date(2026, 9, 1), status: 'normal' },
	{ date: new Date(2026, 9, 2), status: 'normal' },
	{ date: new Date(2026, 9, 3), status: 'over' },
	{ date: new Date(2026, 9, 4), status: 'normal' },
	{ date: SEED_TODAY, status: 'normal' },
]

export const SEED_VOICE_LEVELS = [
	6, 10, 16, 12, 20, 26, 14, 8, 18, 24, 28, 16, 10, 22, 30, 20, 12, 8, 14, 22,
] as const

/** Time dividers in the chat mockups. */
export const SEED_CHAT_TIMES = { dinnerQuestion: '18:20', failedLunch: '13:05' } as const
