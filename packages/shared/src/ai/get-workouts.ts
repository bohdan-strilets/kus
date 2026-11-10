// get_workouts: the model reads the user's logged workouts of a period. Schema, description and the
// result text live here, so the backend and the eval answer the call with the same functions; only
// the numbers (counted by the backend, never by the model) come from outside.
import { z } from 'zod'

import { programModeSchema } from '../schemas/enums.js'
import { toContextText } from './memory-context.js'
import { joinReadDigest } from './read-digest.js'

export const GET_WORKOUTS_TOOL_NAME = 'get_workouts'
export const GET_WORKOUTS_DAYS_MIN = 1
export const GET_WORKOUTS_DAYS_MAX = 92
export const GET_WORKOUTS_EXERCISE_MAX_LENGTH = 40
/** Most sessions the result lists, newest first; the rest are only counted. */
export const GET_WORKOUTS_SESSIONS_MAX = 20
/** Most exercises the result lists. */
export const GET_WORKOUTS_EXERCISES_MAX = 12
/** Most exercise names of the user's dictionary the result shows when nothing matched. */
export const GET_WORKOUTS_KNOWN_EXERCISES_MAX = 10

export const getWorkoutsInputSchema = z.object({
	days: z
		.number()
		.int()
		.min(GET_WORKOUTS_DAYS_MIN)
		.max(GET_WORKOUTS_DAYS_MAX)
		.describe(
			'Days the period covers, ending on endDate: a week 7, a month 30, "цього місяця" — days from the 1st to today',
		),
	endDate: z.iso
		.date()
		.nullable()
		.default(null)
		.describe('Last day of the period, YYYY-MM-DD; null = today'),
	exercise: z
		.string()
		.trim()
		.min(1)
		.max(GET_WORKOUTS_EXERCISE_MAX_LENGTH)
		.nullable()
		.default(null)
		.describe('One exercise in the user\'s words ("жим"), or null for all'),
})

export type GetWorkoutsInput = z.infer<typeof getWorkoutsInputSchema>

/** Told to the model as a tool result: it can fix its arguments within the same turn. */
export const GET_WORKOUTS_INVALID_ARGUMENTS_RESULT = `error: invalid arguments — days is ${GET_WORKOUTS_DAYS_MIN}–${GET_WORKOUTS_DAYS_MAX}, endDate is YYYY-MM-DD or null, exercise is 1–${GET_WORKOUTS_EXERCISE_MAX_LENGTH} characters or null`

/** The model's raw JSON arguments; null when they are not JSON or do not fit the schema. */
export const parseGetWorkoutsArguments = (raw: string): GetWorkoutsInput | null => {
	try {
		const parsed = getWorkoutsInputSchema.safeParse(JSON.parse(raw))
		return parsed.success ? parsed.data : null
	} catch {
		// not JSON: the model gets «invalid arguments» and may send them again
		return null
	}
}

export const GET_WORKOUTS_DESCRIPTION =
	"Read the user's logged workouts of a period: sessions (date, template, duration), first and last date, count, exercises with best working sets, records, missed program days. " +
	'The result always starts with the first workout ever and the all-time count. ' +
	'Numbers are counted by the app: quote them, never recount. ' +
	'Do NOT call it for today only: "Today\'s workouts" is in the context. It only reads: nothing is logged.'

const isoDateSchema = z.iso.date()

const topSetSchema = z.object({ weightKg: z.number().nullable(), reps: z.number() })

export const workoutsReadRecordTypeSchema = z.enum(['WEIGHT', 'DISTANCE', 'REPS'])

/** What the backend counted for one call; the eval's fixtures have the same shape. */
export const workoutsReadDataSchema = z.object({
	from: isoDateSchema,
	to: isoDateSchema,
	days: z.number().int(),
	/** Over all time, whatever the period or the exercise. */
	firstEverDate: isoDateSchema.nullable(),
	totalEver: z.number().int(),
	exercise: z.object({ query: z.string(), matched: z.array(z.string()) }).nullable(),
	/** Names of the user's exercises, only when `exercise` matched nothing. */
	knownExercises: z.array(z.string()).optional(),
	/** Counted workouts of the period, whatever the exercise: what `count` is a part of. */
	periodCount: z.number().int(),
	count: z.number().int(),
	firstDate: isoDateSchema.nullable(),
	lastDate: isoDateSchema.nullable(),
	avgDurationMin: z.number().nullable(),
	hasEstimatedDuration: z.boolean(),
	workingSets: z.number().int(),
	/** Newest first. */
	sessions: z.array(
		z.object({
			date: isoDateSchema,
			templateName: z.string().nullable(),
			durationMin: z.number().nullable(),
			isDurationEstimate: z.boolean(),
			exercises: z.array(
				z.object({ name: z.string(), summary: z.string(), isRecord: z.boolean() }),
			),
		}),
	),
	/** Sessions older than the listed ones. */
	olderNotListed: z.number().int(),
	exercises: z.array(
		z.object({
			name: z.string(),
			sessionCount: z.number().int(),
			setCount: z.number().int(),
			bestInPeriod: topSetSchema.nullable(),
			bestEver: topSetSchema.nullable(),
			bestEverDate: isoDateSchema.nullable(),
			/** Last point of the period minus the first (kg, or reps for a bodyweight exercise). */
			change: z.number().nullable(),
		}),
	),
	records: z.array(
		z.object({
			date: isoDateSchema,
			exercise: z.string(),
			type: workoutsReadRecordTypeSchema,
			/** kg, km or reps by the type. */
			value: z.number(),
		}),
	),
	program: z
		.object({
			title: z.string().nullable(),
			mode: programModeSchema,
			perWeek: z.number().int().nullable(),
			since: isoDateSchema,
			/** The weeks (or days) the plan check judged; null when none is over yet. */
			judged: z.object({ from: isoDateSchema, to: isoDateSchema }).nullable(),
			planned: z.number().int(),
			done: z.number().int(),
			missed: z.array(
				z.object({
					from: isoDateSchema,
					to: isoDateSchema,
					done: z.number().int(),
					planned: z.number().int(),
				}),
			),
			/** Workouts of the period the check did not count (outside the judged weeks, above N a week). */
			notJudged: z.number().int(),
			/** The week of the period that is not over: told apart, never a miss. */
			thisWeek: z
				.object({
					from: isoDateSchema,
					to: isoDateSchema,
					done: z.number().int(),
					planned: z.number().int(),
				})
				.nullable(),
		})
		.nullable(),
	/** An open live session exists: it is not counted here, only "Today's workouts" has it. */
	hasOpenSession: z.boolean(),
})

export type WorkoutsReadData = z.infer<typeof workoutsReadDataSchema>

type ReadExerciseSummary = WorkoutsReadData['exercises'][number]
type ReadTopSet = NonNullable<ReadExerciseSummary['bestInPeriod']>

export const OPEN_SESSION_NOTE =
	'An open session of today is not counted here — see "Today\'s workouts".'

const RECORD_UNITS: Readonly<Record<WorkoutsReadData['records'][number]['type'], string>> = {
	WEIGHT: 'kg',
	DISTANCE: 'km',
	REPS: 'reps',
}

const PROGRAM_MODE_LABELS: Readonly<
	Record<NonNullable<WorkoutsReadData['program']>['mode'], string>
> = {
	ROTATE: 'rotation',
	SINGLE: 'one workout',
	WEEKDAYS: 'fixed weekdays',
}

/** `YYYY-MM-DD` → `DD.MM` */
const toShortDate = (date: string): string => `${date.slice(8, 10)}.${date.slice(5, 7)}`

const formatTopSet = ({ weightKg, reps }: ReadTopSet): string =>
	weightKg === null ? `${reps} reps` : `${weightKg} kg×${reps}`

const formatSigned = (value: number): string => (value > 0 ? `+${value}` : `${value}`)

const quote = (name: string): string => `"${toContextText(name)}"`

const formatExerciseLine = (exercise: ReadExerciseSummary): string => {
	const parts = [`${exercise.sessionCount} sessions`, `${exercise.setCount} working sets`]
	if (exercise.bestInPeriod) parts.push(`best in period ${formatTopSet(exercise.bestInPeriod)}`)
	if (exercise.bestEver) {
		const when = exercise.bestEverDate === null ? '' : ` on ${exercise.bestEverDate}`
		parts.push(`best ever ${formatTopSet(exercise.bestEver)}${when}`)
	}
	if (exercise.change !== null) {
		const unit = exercise.bestEver?.weightKg === null ? 'reps' : 'kg'
		parts.push(`change ${formatSigned(exercise.change)} ${unit}`)
	}
	return `- ${quote(exercise.name)}: ${parts.join('; ')}`
}

const formatRange = (from: string, to: string): string =>
	from === to ? toShortDate(from) : `${toShortDate(from)}–${toShortDate(to)}`

const formatShortWeeks = (missed: NonNullable<WorkoutsReadData['program']>['missed']): string =>
	missed.length === 0
		? ''
		: `; short weeks: ${missed
				.map(({ from, to, done, planned }) => `${formatRange(from, to)} ${done} of ${planned}`)
				.join(', ')}`

const hasPlanToCheck = (program: NonNullable<WorkoutsReadData['program']>): boolean =>
	program.mode === 'WEEKDAYS' || program.perWeek !== null

/**
 * The program line says which weeks (days) the plan check counted and how many workouts of the
 * period stayed outside it, so a count of the period never reads as a miss.
 */
const formatProgram = (
	program: NonNullable<WorkoutsReadData['program']>,
	periodCount: number,
): string => {
	const title = program.title === null ? '' : ` ${quote(program.title)}`
	const mode =
		program.perWeek === null
			? PROGRAM_MODE_LABELS[program.mode]
			: `${program.perWeek}/week, ${PROGRAM_MODE_LABELS[program.mode]}`
	const head = `Program${title} (${mode}) since ${program.since}.`
	if (!hasPlanToCheck(program)) return head
	const { judged } = program
	const isWeekdays = program.mode === 'WEEKDAYS'
	if (judged === null) {
		return `${head} ${isWeekdays ? 'No planned day of the period is over yet' : 'No whole week of the period is over yet'}: nothing to judge.`
	}
	const scope = isWeekdays
		? `Plan check counts planned weekdays from ${toShortDate(judged.from)} to ${toShortDate(judged.to)}`
		: `Plan check counts only whole Mon–Sun weeks of the period that are over: ${formatRange(judged.from, judged.to)} —`
	const counted = `${scope}${isWeekdays ? ':' : ''} planned ${program.planned}, done ${program.done}${formatShortWeeks(program.missed)}.`
	if (program.notJudged === 0) return `${head} ${counted}`
	const outside = isWeekdays ? 'outside these days' : 'outside these weeks'
	const above = program.perWeek === null ? '' : ` or above ${program.perWeek}/week`
	return `${head} ${counted} Not in the check: ${program.notJudged} of the period's ${periodCount} workouts (${outside}${above}).`
}

const formatThisWeek = (program: NonNullable<WorkoutsReadData['program']>): string | null => {
	const { thisWeek } = program
	if (thisWeek === null) return null
	const days = program.mode === 'WEEKDAYS' ? ' planned days up to today' : ''
	return `This week so far: ${thisWeek.done} of ${thisWeek.planned}${days} (not over).`
}

const formatSummaryLine = (data: WorkoutsReadData): string => {
	const label =
		data.exercise === null
			? `Workouts: ${data.count}`
			: `Workouts with it: ${data.count} of ${data.periodCount} in the period`
	const range =
		data.firstDate !== null && data.lastDate !== null
			? ` (first ${data.firstDate}, last ${data.lastDate})`
			: ''
	const avg =
		data.avgDurationMin === null
			? ''
			: `; avg ${data.avgDurationMin} min${data.hasEstimatedDuration ? ' (some estimated)' : ''}`
	return `${label}${range}${avg}; working sets ${data.workingSets}.`
}

const formatExerciseMatch = (
	exercise: NonNullable<WorkoutsReadData['exercise']>,
	known: readonly string[] | undefined,
): string => {
	if (exercise.matched.length > 0) {
		const perExercise = exercise.matched.length > 1 ? ' Figures below are per exercise.' : ''
		return `Matched exercises: ${exercise.matched.map(quote).join('; ')} (the user said ${quote(exercise.query)}).${perExercise}`
	}
	const names = known && known.length > 0 ? ` Known exercises: ${known.map(quote).join(', ')}.` : ''
	return `Exercise ${quote(exercise.query)}: no match among the user's exercises.${names}`
}

const formatCountLine = (data: WorkoutsReadData): string => {
	if (data.count > 0) return formatSummaryLine(data)
	return data.exercise === null || data.periodCount === 0
		? 'No workouts in this period.'
		: `No workouts with it in this period (${data.periodCount} workouts in all).`
}

const formatSession = (session: WorkoutsReadData['sessions'][number]): string => {
	const template = session.templateName === null ? '' : ` ${quote(session.templateName)}`
	const duration =
		session.durationMin === null
			? ''
			: ` ${session.isDurationEstimate ? '≈' : ''}${session.durationMin} min`
	const exercises = session.exercises
		.map(({ name, summary, isRecord }) => {
			const text = summary === '' ? quote(name) : `${quote(name)} ${summary}`
			return isRecord ? `${text} (record)` : text
		})
		.join('; ')
	return `- ${session.date}${template}${duration}${exercises === '' ? '' : `: ${exercises}`}`
}

/** The tool result the model reads: numbers as the backend counted them, one fact per line. */
export const formatGetWorkoutsResult = (data: WorkoutsReadData): string => {
	const first =
		data.firstEverDate === null
			? 'First workout ever: none logged'
			: `First workout ever: ${data.firstEverDate}`
	const lines = [
		`Period ${data.from}…${data.to} (${data.days} days). ${first}; all time: ${data.totalEver} workouts.`,
	]
	if (data.exercise !== null) lines.push(formatExerciseMatch(data.exercise, data.knownExercises))
	lines.push(formatCountLine(data))
	if (data.program !== null) {
		lines.push(formatProgram(data.program, data.periodCount))
		const thisWeek = formatThisWeek(data.program)
		if (thisWeek !== null) lines.push(thisWeek)
	}
	if (data.sessions.length > 0) {
		lines.push('Sessions, newest first:', ...data.sessions.map(formatSession))
		if (data.olderNotListed > 0) lines.push(`(${data.olderNotListed} older not listed)`)
	}
	if (data.exercises.length > 0) lines.push('Exercises:', ...data.exercises.map(formatExerciseLine))
	if (data.records.length > 0) {
		lines.push(
			data.exercise === null ? 'Records in period:' : 'Records in period (this exercise only):',
			...data.records.map(
				({ date, exercise, type, value }) =>
					`- ${date} ${quote(exercise)} ${type} ${value} ${RECORD_UNITS[type]}`,
			),
		)
	}
	if (data.hasOpenSession) lines.push(OPEN_SESSION_NOTE)
	return lines.join('\n')
}

const DIGEST_DATES_MAX = 5
const DIGEST_SHORT_WEEKS_MAX = 2
const DIGEST_RECORDS_MAX = 3
const DIGEST_NAME_MAX_CHARS = 24

const quoteShort = (name: string): string => {
	const text = toContextText(name)
	return text.length > DIGEST_NAME_MAX_CHARS
		? `"${text.slice(0, DIGEST_NAME_MAX_CHARS - 1).trimEnd()}…"`
		: `"${text}"`
}

const formatProgramDigest = (program: NonNullable<WorkoutsReadData['program']>): string | null => {
	if (!hasPlanToCheck(program)) return null
	const label =
		program.perWeek === null ? PROGRAM_MODE_LABELS[program.mode] : `${program.perWeek}/week`
	if (program.judged === null) return `program ${label}: nothing to judge yet`
	if (program.missed.length === 0) {
		return `program ${label}: ${program.done} of ${program.planned} as planned`
	}
	const weeks = program.missed
		.slice(0, DIGEST_SHORT_WEEKS_MAX)
		.map(({ from, to, done, planned }) => `${formatRange(from, to)} ${done} of ${planned}`)
	return `program ${label}: ${weeks.join(', ')}`
}

/**
 * What a get_workouts call told the model, in one short line for the history of the next turns:
 * the period, the count with its dates, the program verdict, the newest records. Built from the same
 * data as the result, so the numbers cannot differ. Starts with `read workouts`, as the marker shows it.
 */
export const formatWorkoutsDigest = (data: WorkoutsReadData): string => {
	const range = formatRange(data.from, data.to)
	const exercise = data.exercise === null ? '' : `, ${quoteShort(data.exercise.query)}`
	const count = data.exercise === null ? `${data.count}` : `${data.count} of ${data.periodCount}`
	const dates = data.sessions
		.slice(0, DIGEST_DATES_MAX)
		.map(({ date }) => toShortDate(date))
		.reverse()
	const list = dates.length > 0 ? ` (${dates.join(', ')})` : ''
	const program = data.program === null ? null : formatProgramDigest(data.program)
	const records = data.records
		.slice(0, DIGEST_RECORDS_MAX)
		.map(
			({ date, exercise: name, type, value }) =>
				`${toShortDate(date)} ${quoteShort(name)} ${value} ${RECORD_UNITS[type]}`,
		)
	return joinReadDigest(`read workouts ${range}${exercise}: ${count}${list}`, [
		...(program === null ? [] : [program]),
		...(records.length > 0 ? [`records: ${records.join(', ')}`] : []),
	])
}
