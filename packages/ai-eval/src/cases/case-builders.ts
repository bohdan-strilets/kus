import {
	type DayContext,
	type FoodCategory,
	type FoodParseContext,
	getLoggableDays,
	type LoggableMealType,
	type TodayEntryContext,
} from '@kus/shared'

import type { ExpectedValue } from './case.types.js'

const DECIMALS = 10

/** The fixed local day of the eval clock (see BASE_CONTEXT); measurement dates are judged against it. */
export const EVAL_TODAY = '2026-10-07'

/** Value for a weighed portion from per-100 g reference data. */
export const per100 = (valuePer100g: number, grams: number): ExpectedValue => ({
	exact: Math.round(((valuePer100g * grams) / 100) * DECIMALS) / DECIMALS,
})

export const exact = (value: number): ExpectedValue => ({ exact: value })

export const range = (min: number, max: number): ExpectedValue => ({ min, max })

const round = (value: number): number => Math.round(value * DECIMALS) / DECIMALS

/** Energy split of a typical mixed dish, used when a case doesn't care about the macros. */
const DEFAULT_SPLIT = { protein: 0.2, fat: 0.3, carbs: 0.5 } as const

/** A logged entry of the day context (`e1`…), macros adding up to its kcal unless given. */
export const entry = (
	ref: string,
	name: string,
	mealType: LoggableMealType,
	grams: number,
	kcal: number,
	category: FoodCategory,
	macros: Partial<Pick<TodayEntryContext, 'protein' | 'fat' | 'carbs' | 'isEdited'>> = {},
): TodayEntryContext => ({
	ref,
	name,
	mealType,
	grams,
	kcal,
	protein: macros.protein ?? round((kcal * DEFAULT_SPLIT.protein) / 4),
	fat: macros.fat ?? round((kcal * DEFAULT_SPLIT.fat) / 9),
	carbs: macros.carbs ?? round((kcal * DEFAULT_SPLIT.carbs) / 4),
	fiber: null,
	category,
	source: 'ESTIMATE',
	isEdited: macros.isEdited ?? false,
})

const LOCAL_DAY = /^(\d{4}-\d{2}-\d{2})\b/

/** The case's today: the context's local day, else the eval clock. */
export const getCaseToday = (context: { measurements?: { today: string } } | undefined): string =>
	context?.measurements?.today ?? EVAL_TODAY

/**
 * Another clock for a case ('2026-10-08 00:40, Thursday'): sets `localTime` and the measurements'
 * `today` together, so the two never disagree about the day.
 */
export const atClock = (localTime: string): Partial<FoodParseContext> => {
	const today = LOCAL_DAY.exec(localTime)?.[1]
	if (!today) throw new Error(`localTime must start with YYYY-MM-DD: ${localTime}`)
	return { localTime, measurements: { today, weights: [], waist: null, targetWeightKg: null } }
}

/** What the backend counted for a day of the "Days" context (before the defaults of an empty day). */
export type DayOverride = Partial<Pick<DayContext, 'kcal' | 'overKcal' | 'entryCount'>>

/** The "Days" context of a case clock: every loggable day, empty unless `byDate` says otherwise. */
export const buildDays = (
	today: string,
	byDate: Readonly<Record<string, DayOverride>> = {},
): DayContext[] =>
	getLoggableDays(today).map(({ localDate, label }) => ({
		localDate,
		label,
		kcal: 0,
		overKcal: null,
		entryCount: 0,
		...byDate[localDate],
	}))
