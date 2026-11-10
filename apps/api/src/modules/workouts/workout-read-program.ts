import type { ProgramMode, WorkoutsReadData } from '@kus/shared'

import { addDays, DAYS_IN_WEEK, getWeekStart, isInRange, toTime } from './workout-stats-period'

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

/** N a week: whole weeks after the program started and over before today; sessions above N do not make up for other weeks. */
const getPerWeekTally = ({
	perWeek,
	since,
	from,
	to,
	today,
	dates,
}: {
	perWeek: number
	since: string
	from: string
	to: string
	today: string
	dates: readonly string[]
}): Pick<ReadProgram, 'planned' | 'done' | 'missed'> => {
	const weeks = getWeeks(from, to).filter(
		(week) => week.from >= from && week.from >= since && week.to <= to && week.to < today,
	)
	const counts = weeks.map((week) => ({ week, done: Math.min(countOn(dates, week), perWeek) }))
	return {
		planned: weeks.length * perWeek,
		done: counts.reduce((total, { done }) => total + done, 0),
		missed: counts
			.filter(({ done }) => done < perWeek)
			.map(({ week, done }) => ({ ...week, done, planned: perWeek })),
	}
}

/** Fixed weekdays: a planned day is missed when nothing was done on it; days from the start to yesterday. */
const getWeekdaysTally = ({
	weekdays,
	since,
	from,
	to,
	today,
	dates,
}: {
	weekdays: readonly number[]
	since: string
	from: string
	to: string
	today: string
	dates: readonly string[]
}): Pick<ReadProgram, 'planned' | 'done' | 'missed'> => {
	const start = maxDate(from, since)
	const end = minDate(to, addDays(today, -1))
	const empty = { planned: 0, done: 0, missed: [] }
	if (start > end || weekdays.length === 0) return empty
	const trained = new Set(dates)
	const tallies = getWeeks(start, end).map((week) => {
		const range = { from: maxDate(week.from, start), to: minDate(week.to, end) }
		const planned: string[] = []
		for (let day = range.from; day <= range.to; day = addDays(day, 1)) {
			if (weekdays.includes(getIsoWeekday(day))) planned.push(day)
		}
		return {
			range,
			planned: planned.length,
			done: planned.filter((day) => trained.has(day)).length,
		}
	})
	return {
		planned: tallies.reduce((total, { planned }) => total + planned, 0),
		done: tallies.reduce((total, { done }) => total + done, 0),
		missed: tallies
			.filter(({ planned, done }) => done < planned)
			.map(({ range, planned, done }) => ({ ...range, done, planned })),
	}
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
	const base = { title, mode, perWeek, since }
	const none = { planned: 0, done: 0, missed: [] }
	if (mode === 'WEEKDAYS') {
		return { ...base, ...getWeekdaysTally({ weekdays, since, from, to, today, dates }) }
	}
	if (perWeek === null) return { ...base, ...none }
	return { ...base, ...getPerWeekTally({ perWeek, since, from, to, today, dates }) }
}
