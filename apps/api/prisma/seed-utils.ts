import { DEMO_TIMEZONE, type Macros } from './seed-data'

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

/** Today's calendar date in the demo timezone, as a UTC-midnight Date for @db.Date columns. */
const getTodayLocalDate = (): Date => {
	// en-CA formats as YYYY-MM-DD
	const today = new Intl.DateTimeFormat('en-CA', { timeZone: DEMO_TIMEZONE }).format(new Date())
	return new Date(`${today}T00:00:00Z`)
}

export const getLocalDate = (daysAgo: number): Date =>
	new Date(getTodayLocalDate().getTime() - daysAgo * DAY_MS)

/** A moment on the given local day, never in the future when the seed runs early in the morning. */
export const getUtcTimeOnLocalDate = (daysAgo: number, utcHour: number, minute = 0): Date =>
	new Date(
		Math.min(getLocalDate(daysAgo).getTime() + utcHour * HOUR_MS + minute * MINUTE_MS, Date.now()),
	)

const roundToTenth = (value: number): number => Math.round(value * 10) / 10

/** Scales macros by a factor (e.g. grams / 100) — the backend, not the AI, does this math. */
export const scaleMacros = (base: Macros, factor: number): Macros => ({
	kcal: roundToTenth(base.kcal * factor),
	proteinG: roundToTenth(base.proteinG * factor),
	fatG: roundToTenth(base.fatG * factor),
	carbsG: roundToTenth(base.carbsG * factor),
	fiberG: base.fiberG === null ? null : roundToTenth(base.fiberG * factor),
})

export const sumMacros = (items: Macros[]): Macros =>
	items.reduce<Macros>(
		(total, item) => ({
			kcal: total.kcal + item.kcal,
			proteinG: total.proteinG + item.proteinG,
			fatG: total.fatG + item.fatG,
			carbsG: total.carbsG + item.carbsG,
			fiberG:
				total.fiberG === null && item.fiberG === null
					? null
					: (total.fiberG ?? 0) + (item.fiberG ?? 0),
		}),
		{ kcal: 0, proteinG: 0, fatG: 0, carbsG: 0, fiberG: null },
	)

/** Same normalization the backend applies before matching names and aliases. */
export const normalizeName = (name: string): string =>
	name.trim().toLowerCase().replace(/\s+/g, ' ')
