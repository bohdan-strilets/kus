import {
	type ExerciseKind,
	type ProgramChangeLine,
	type ProgramChanges,
	programModeSchema,
	type TemplateExerciseTarget,
} from '@kus/shared'
import type { TFunction } from 'i18next'

import { DETAIL_SEPARATOR } from '@/entities/workout'

import {
	formatProgramTarget,
	formatProgramTemplateMeta,
	type ProgramTemplateMetaSource,
} from './format-program'
import { getWeekdayShortName } from './weekdays'

/**
 * Where an added line finds what it added: the draft of a proposal card, or the program in force
 * (a version keeps only the lines, so an exercise or day dropped since then shows no plan).
 */
export interface ProgramChangeContext {
	templates: readonly (Omit<ProgramTemplateMetaSource, 'exercises'> & {
		name: string
		exercises: readonly { name: string; kind: ExerciseKind; target: TemplateExerciseTarget }[]
	})[]
}

export type ProgramChangeKind = 'added' | 'removed' | 'changed'

export interface ProgramChangeRow {
	key: string
	kind: ProgramChangeKind
	title: string
	/** «3 підходи · 8–12 повт. · 70 кг», «було … · стало …»; null when the line has nothing to add. */
	detail: string | null
	/** The new target of a changed exercise, «4 підходи · 12–15 повт.»; the one-line list says only that. */
	after?: string | null
}

export interface ProgramChangeGroup {
	key: string
	/** The template the rows belong to, or «Програма» for the lines of the whole program. */
	label: string
	rows: ProgramChangeRow[]
}

const TEMPLATE_NAME_PREFIX = 'Тренування '

/** «Тренування Б» → «Б»; any other name stays as it is. */
export const getTemplateShortLabel = (name: string): string =>
	name.startsWith(TEMPLATE_NAME_PREFIX) && name.length > TEMPLATE_NAME_PREFIX.length
		? name.slice(TEMPLATE_NAME_PREFIX.length)
		: name

/**
 * A change as one line (the sheet «Що змінилось»): «Б: Махи — 4 підходи · 12–15 повт.» for a change,
 * «Б: Присідання · 3 підходи · 8–12 повт. · 70 кг» for an added one, just «Б: Жим ногами» for a removed one
 * (the view strikes it out).
 */
export const formatProgramChangeLine = (row: ProgramChangeRow, templateName: string): string => {
	const title = `${getTemplateShortLabel(templateName)}: ${row.title}`
	if (row.kind === 'removed') return title
	if (row.kind === 'added')
		return row.detail === null ? title : `${title}${DETAIL_SEPARATOR}${row.detail}`
	const detail = row.after ?? row.detail
	return detail === null ? title : `${title} — ${detail}`
}

/** `program.diff.title` is the heading of the card, so the name of the program has its own key. */
const PROGRAM_FIELD_KEY = {
	mode: 'program.diff.mode',
	perWeek: 'program.diff.perWeek',
	title: 'program.diff.programTitle',
} as const

const NO_VALUE = '—'

const isTarget = (value: unknown): value is TemplateExerciseTarget =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

/** A change line has no kind of its own: a target with minutes or km and no sets is a cardio one. */
const getTargetKind = (target: TemplateExerciseTarget): ExerciseKind =>
	target.sets === null && (target.durationMin !== null || target.distanceM !== null)
		? 'CARDIO'
		: 'STRENGTH'

const formatTargetValue = (value: unknown, t: TFunction): string =>
	isTarget(value)
		? (formatProgramTarget({ kind: getTargetKind(value), target: value }, t) ?? NO_VALUE)
		: NO_VALUE

const formatWeekdays = (value: unknown): string => {
	if (!Array.isArray(value) || value.length === 0) return NO_VALUE
	return value
		.filter((day): day is number => typeof day === 'number')
		.toSorted((a, b) => a - b)
		.map(getWeekdayShortName)
		.join(', ')
}

const formatScalar = (value: unknown, t: TFunction, field: ProgramChangeLine['field']): string => {
	if (field === 'mode') {
		const mode = programModeSchema.safeParse(value)
		if (mode.success) return t(`program.mode.${mode.data}`)
	}
	if (typeof value === 'string' || typeof value === 'number') return String(value)
	return NO_VALUE
}

const beforeAfter = (before: string, after: string, t: TFunction): string =>
	t('program.diff.beforeAfter', { before, after })

/**
 * «4 підходи замість 3»: a change of the number of sets alone is told short; the old number is in
 * the `before` of the line. Any other difference keeps the full new target.
 */
const formatSetsInstead = (line: ProgramChangeLine, t: TFunction): string | null => {
	const { before, after } = line
	if (!isTarget(before) || !isTarget(after)) return null
	const { sets: beforeSets, ...beforeRest } = before
	const { sets: afterSets, ...afterRest } = after
	if (beforeSets === null || afterSets === null || beforeSets === afterSets) return null
	const isOnlySets = (Object.keys(afterRest) as (keyof typeof afterRest)[]).every(
		(field) => beforeRest[field] === afterRest[field],
	)
	return isOnlySets
		? t('program.diff.setsInstead', {
				after: t('workout.setCountFull', { count: afterSets }),
				before: beforeSets,
			})
		: null
}

const getExerciseTarget = (
	line: ProgramChangeLine,
	program: ProgramChangeContext,
	t: TFunction,
): string | null => {
	const exercise = program.templates
		.find((template) => template.name === line.templateName)
		?.exercises.find((candidate) => candidate.name === line.name)
	return exercise ? formatProgramTarget(exercise, t, { withDetails: true }) : null
}

const getTemplateMeta = (
	line: ProgramChangeLine,
	program: ProgramChangeContext,
	t: TFunction,
): string | null => {
	const template = program.templates.find((candidate) => candidate.name === line.templateName)
	return template ? formatProgramTemplateMeta(template, t) : null
}

const toRow = (
	line: ProgramChangeLine,
	index: number,
	program: ProgramChangeContext,
	t: TFunction,
): ProgramChangeRow | null => {
	const key = `${index}`
	const name = line.name ?? ''
	if (line.scope === 'EXERCISE') {
		if (line.op === 'ADD') {
			return { key, kind: 'added', title: name, detail: getExerciseTarget(line, program, t) }
		}
		if (line.op === 'REMOVE') {
			// versions saved before the diff carried it have no target to show
			const detail = isTarget(line.before) ? formatTargetValue(line.before, t) : null
			return { key, kind: 'removed', title: name, detail: detail === NO_VALUE ? null : detail }
		}
		if (line.op === 'CHANGE') {
			return {
				key,
				kind: 'changed',
				title: name,
				detail: beforeAfter(formatTargetValue(line.before, t), formatTargetValue(line.after, t), t),
				after:
					formatSetsInstead(line, t) ??
					(isTarget(line.after) ? formatTargetValue(line.after, t) : null),
			}
		}
		return null
	}
	if (line.scope === 'TEMPLATE') {
		if (line.op === 'ADD') {
			return { key, kind: 'added', title: name, detail: getTemplateMeta(line, program, t) }
		}
		if (line.op === 'REMOVE') return { key, kind: 'removed', title: name, detail: null }
		if (line.op === 'REORDER') {
			return { key, kind: 'changed', title: t('program.diff.reorder'), detail: null }
		}
		if (line.field === 'weekdays') {
			return {
				key,
				kind: 'changed',
				title: t('program.diff.weekdays'),
				detail: beforeAfter(formatWeekdays(line.before), formatWeekdays(line.after), t),
			}
		}
		if (line.field === 'name') {
			return {
				key,
				kind: 'changed',
				title: t('program.diff.templateName'),
				detail: beforeAfter(
					formatScalar(line.before, t, line.field),
					formatScalar(line.after, t, line.field),
					t,
				),
			}
		}
		return null
	}
	if (line.field !== 'mode' && line.field !== 'perWeek' && line.field !== 'title') return null
	return {
		key,
		kind: 'changed',
		title: t(PROGRAM_FIELD_KEY[line.field]),
		detail: beforeAfter(
			formatScalar(line.before, t, line.field),
			formatScalar(line.after, t, line.field),
			t,
		),
	}
}

/**
 * The lines of a proposal card by template, in the order they came: the lines of the whole
 * program first. A line the card can not tell in words is left out rather than shown wrong.
 */
export const getProgramChangeGroups = (
	changes: ProgramChanges,
	program: ProgramChangeContext,
	t: TFunction,
): ProgramChangeGroup[] => {
	const groups = new Map<string, ProgramChangeGroup>()
	changes.lines.forEach((line, index) => {
		const row = toRow(line, index, program, t)
		if (row === null) return
		const key = line.scope === 'PROGRAM' ? '' : (line.templateName ?? '')
		const group = groups.get(key) ?? {
			key,
			label: key === '' ? t('program.diff.programGroup') : key,
			rows: [],
		}
		group.rows.push(row)
		groups.set(key, group)
	})
	return [...groups.values()]
}
