/** Below ~800 kcal a day is an extreme deficit (CLAUDE.md §6); above 6000 — a typo. */
export const GOAL_KCAL = { min: 800, max: 6000 } as const
export const GOAL_MACRO_GRAMS = { min: 0, max: 600 } as const
