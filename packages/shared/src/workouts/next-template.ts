import { getWeekday, shiftDate, type Weekday } from '../ai/dates.js'
import type { ProgramMode } from '../schemas/enums.js'
import { WEEKDAY_ISO_MAX } from '../schemas/programs.js'

export interface NextTemplateCandidate {
	key: string
	position: number
	weekdays: readonly number[]
}

export interface LastTemplatedWorkout {
	templateKey: string
	/** `YYYY-MM-DD`, the user's local date */
	localDate: string
}

export interface NextTemplate {
	key: string
	/** ISO weekday (1 = Monday) — only in WEEKDAYS mode */
	weekday: number | null
	/** `YYYY-MM-DD` of the planned day — only in WEEKDAYS mode */
	date: string | null
	isToday: boolean
}

export interface GetNextTemplateInput {
	mode: ProgramMode
	templates: readonly NextTemplateCandidate[]
	pinnedTemplateKey: string | null
	lastTemplatedWorkout: LastTemplatedWorkout | null
	/** the user's local date, `YYYY-MM-DD` */
	today: string
}

const ISO_WEEKDAYS: Record<Weekday, number> = {
	Mon: 1,
	Tue: 2,
	Wed: 3,
	Thu: 4,
	Fri: 5,
	Sat: 6,
	Sun: 7,
}

export const getIsoWeekday = (date: string): number => ISO_WEEKDAYS[getWeekday(date)]

const plain = (key: string): NextTemplate => ({ key, weekday: null, date: null, isToday: false })

const getNextByTurn = (
	templates: readonly NextTemplateCandidate[],
	last: LastTemplatedWorkout | null,
): NextTemplate | null => {
	const first = templates[0]
	if (!first) return null
	const lastIndex = last ? templates.findIndex((template) => template.key === last.templateKey) : -1
	if (lastIndex === -1) return plain(first.key)
	return plain((templates[(lastIndex + 1) % templates.length] ?? first).key)
}

const getNextByWeekday = (
	templates: readonly NextTemplateCandidate[],
	last: LastTemplatedWorkout | null,
	today: string,
): NextTemplate | null => {
	if (!templates.some((template) => template.weekdays.length > 0)) return null
	for (let offset = 0; offset <= WEEKDAY_ISO_MAX; offset += 1) {
		const date = shiftDate(today, offset)
		const weekday = getIsoWeekday(date)
		const found = templates.find(
			(template) =>
				template.weekdays.includes(weekday) &&
				// today's session is already done
				!(offset === 0 && last?.localDate === today && last.templateKey === template.key),
		)
		if (found) return { key: found.key, weekday, date, isToday: offset === 0 }
	}
	return null
}

/** The workout to suggest next. The API passes `today` as the user's local date, so the timezone is already applied. */
export const getNextTemplate = (input: GetNextTemplateInput): NextTemplate | null => {
	const templates = [...input.templates].sort((a, b) => a.position - b.position)
	if (input.mode === 'WEEKDAYS') {
		return getNextByWeekday(templates, input.lastTemplatedWorkout, input.today)
	}
	if (input.mode === 'SINGLE') {
		const pinned = templates.find((template) => template.key === input.pinnedTemplateKey)
		const chosen = pinned ?? templates[0]
		return chosen ? plain(chosen.key) : null
	}
	return getNextByTurn(templates, input.lastTemplatedWorkout)
}
