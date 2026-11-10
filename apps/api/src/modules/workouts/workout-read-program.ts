import type { ProgramMode, WorkoutsReadData } from '@kus/shared'

import {
	addDays,
	DAYS_IN_WEEK,
	type DateRange,
	getWeekStart,
	isInRange,
	toTime,
} from './workout-stats-period'

type ReadProgram = NonNullable<WorkoutsReadData['program']>

/** The active program as the read needs it; `since` is its first day (user's local). */
export interface ReadProgramInput {
	title: string | null
	mode: ProgramMode
	perWeek: number | null
	since: string
	/** ISO weekdays (1 = Monday) of all templates of the active version. */
	weekdays: readonly number[]
}

const ISO_SUNDAY = 7

const getIsoWeekday = (date: string): number => {
	const weekday = new Date(toTime(date)).getUTCDay()
	return weekday === 0 ? ISO_SUNDAY : weekday
}

const maxDate = (a: string, b: string): string => (a > b ? a : b)
const minDate = (a: string, b: string): string => (a < b ? a : b)

interface Week {
	from: string
	to: string
}

/** Calendar Monday–Sunday weeks that touch [from, to], not clipped. */
const getWeeks = (from: string, to: string): Week[] => {
	const weeks: Week[] = []
	for (let start = getWeekStart(from); start <= to; start = addDays(start, DAYS_IN_WEEK)) {
		weeks.push({ from: start, to: addDays(start, DAYS_IN_WEEK - 1) })
	}
	return weeks
}

const countOn = (dates: readonly string[], range: Week): number =>
	dates.filter((date) => isInRange(date, range)).length

type Tally = Pick<ReadProgram, 'planned' | 'done' | 'missed' | 'judged' | 'thisWeek'>

interface TallyInput {
	since: string
	from: string
	to: string
	today: string
	dates: readonly string[]
}

const NO_TALLY: Tally = { planned: 0, done: 0, missed: [], judged: null, thisWeek: null }

/** N a week: whole weeks after the program started and over before today; sessions above N do not make up for other weeks. */
const getPerWeekTally = ({
	perWeek,
	since,
	from,
	to,
	today,
	dates,
}: TallyInput & { perWeek: number }): Tally => {
	const inPeriod = getWeeks(from, to).filter((week) => week.from >= from && week.from >= since)
	const weeks = inPeriod.filter((week) => week.to <= to && week.to < today)
	const counts = weeks.map((week) => ({ week, done: Math.min(countOn(dates, week), perWeek) }))
	// the week that is not over yet is told apart: it is no miss, whatever is done so far
	const current = inPeriod.find((week) => week.to >= today && week.from <= today)
	const first = weeks[0]
	const last = weeks.at(-1)
	return {
		planned: weeks.length * perWeek,
		done: counts.reduce((total, { done }) => total + done, 0),
		missed: counts
			.filter(({ done }) => done < perWeek)
			.map(({ week, done }) => ({ ...week, done, planned: perWeek })),
		judged: first && last ? { from: first.from, to: last.to } : null,
		thisWeek: current
			? { ...current, done: Math.min(countOn(dates, current), perWeek), planned: perWeek }
			: null,
	}
}

/** Planned days of the week, from `from` to `to`, and how many of them were trained on. */
const tallyPlannedDays = ({
	weekdays,
	range,
	trained,
}: {
	weekdays: readonly number[]
	range: DateRange
	trained: ReadonlySet<string>
}): { planned: number; done: number } => {
	const planned: string[] = []
	for (let day = range.from; day <= range.to; day = addDays(day, 1)) {
		if (weekdays.includes(getIsoWeekday(day))) planned.push(day)
	}
	return { planned: planned.length, done: planned.filter((day) => trained.has(day)).length }
}

/** Fixed weekdays: a planned day is missed when nothing was done on it; days from the start to yesterday. */
const getWeekdaysTally = ({
	weekdays,
	since,
	from,
	to,
	today,
	dates,
}: TallyInput & { weekdays: readonly number[] }): Tally => {
	if (weekdays.length === 0) return NO_TALLY
	const start = maxDate(from, since)
	const end = minDate(to, addDays(today, -1))
	const trained = new Set(dates)
	const tallies =
		start > end
			? []
			: getWeeks(start, end).map((week) => {
					const range = { from: maxDate(week.from, start), to: minDate(week.to, end) }
					return { range, ...tallyPlannedDays({ weekdays, range, trained }) }
				})
	// today's planned day may still be done: the current week up to today is told apart
	const currentRange = { from: maxDate(getWeekStart(today), start), to: minDate(today, to) }
	const current =
		currentRange.from <= currentRange.to
			? tallyPlannedDays({ weekdays, range: currentRange, trained })
			: null
	return {
		planned: tallies.reduce((total, { planned }) => total + planned, 0),
		done: tallies.reduce((total, { done }) => total + done, 0),
		missed: tallies
			.filter(({ planned, done }) => done < planned)
			.map(({ range, planned, done }) => ({ ...range, done, planned })),
		judged: start > end ? null : { from: start, to: end },
		thisWeek: current && current.planned > 0 ? { ...currentRange, ...current } : null,
	}
}

const getTally = ({
	mode,
	perWeek,
	weekdays,
	...input
}: TallyInput & {
	mode: ProgramMode
	perWeek: number | null
	weekdays: readonly number[]
}): Tally => {
	if (mode === 'WEEKDAYS') return getWeekdaysTally({ weekdays, ...input })
	return perWeek === null ? NO_TALLY : getPerWeekTally({ perWeek, ...input })
}

/**
 * The program against the facts of the period. `dates` are the days of ALL counted workouts of the
 * period (not only those with a filtered exercise). A rotation or a single workout without a
 * number of workouts a week has no plan to miss: only its name and start are told.
 */
export const buildReadProgram = ({
	program,
	from,
	to,
	today,
	dates,
}: {
	program: ReadProgramInput
	from: string
	to: string
	today: string
	dates: readonly string[]
}): ReadProgram => {
	const { title, mode, perWeek, since, weekdays } = program
	const input = { since, from, to, today, dates }
	const tally = getTally({ mode, perWeek, weekdays, ...input })
	return {
		title,
		mode,
		perWeek,
		since,
		...tally,
		notJudged: Math.max(0, dates.length - tally.done),
	}
}
