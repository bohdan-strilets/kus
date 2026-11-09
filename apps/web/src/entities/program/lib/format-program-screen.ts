import type { ProgramResponse, ProgramVersionItem, ProgramView } from '@kus/shared'
import type { TFunction } from 'i18next'

import { DETAIL_SEPARATOR } from '@/entities/workout'
import { formatDayMonth, formatTime } from '@/shared/lib'

import { getTemplateShortLabel, isCustomTemplateName } from './format-program-changes'

const SEQUENCE_SEPARATOR = ' → '

type RotateTemplate = Pick<ProgramResponse['templates'][number], 'name' | 'position'>

export interface RotateHintParts {
	/** «А → Б → А…» or, with custom names, «Верх → Низ → …»; null for one template. */
	sequence: string | null
	/** True for custom names: they are long, so the screen shows the sequence on its own line, cut with «…». */
	isTruncatable: boolean
	/** «Наступне — те, що йде після останнього зробленого.» */
	next: string
}

/**
 * The parts of the hint under «По черзі», in the order of the position of the templates. Default
 * names are short («А → Б → А…», starting over at the end); as soon as one name is custom, each name
 * stands once and the sequence ends with «…».
 */
export const formatRotateHintParts = (
	templates: readonly RotateTemplate[],
	t: TFunction,
): RotateHintParts => {
	const ordered = [...templates].sort((a, b) => a.position - b.position)
	const next = t('program.screen.hint.ROTATE_next')
	const [first] = ordered
	if (ordered.length < 2 || first === undefined)
		return { sequence: null, isTruncatable: false, next }
	if (ordered.some((template) => isCustomTemplateName(template.name))) {
		const names = ordered.map((template) => getTemplateShortLabel(template.name))
		return {
			sequence: `${names.join(SEQUENCE_SEPARATOR)}${SEQUENCE_SEPARATOR}…`,
			isTruncatable: true,
			next,
		}
	}
	const labels = ordered.map((template) => getTemplateShortLabel(template.name))
	const sequence = `${[...labels, getTemplateShortLabel(first.name)].join(SEQUENCE_SEPARATOR)}…`
	return { sequence, isTruncatable: false, next }
}

/** The hint as one string: «А → Б → А… Наступне — …»; one template has no sequence to show. */
export const formatRotateHint = (templates: readonly RotateTemplate[], t: TFunction): string => {
	const { sequence, next } = formatRotateHintParts(templates, t)
	return sequence === null ? next : t('program.screen.hint.ROTATE', { sequence, next })
}

/** «Все тіло · 2 тренування · 3 рази на тиждень»; the parts the program has no value for are skipped. */
export const formatProgramSubtitle = (
	program: Pick<ProgramResponse, 'title' | 'templates' | 'perWeek'>,
	t: TFunction,
): string =>
	[
		program.title,
		t('program.templateCount', { count: program.templates.length }),
		program.perWeek === null ? null : t('program.perWeek', { count: program.perWeek }),
	]
		.filter((part): part is string => part !== null)
		.join(DETAIL_SEPARATOR)

/** «31 жовтня, 20:15» in the local time of the phone; «· поточна» for the version in force. */
export const formatProgramVersionWhen = (
	version: Pick<ProgramVersionItem, 'createdAt' | 'isCurrent'>,
	t: TFunction,
): string => {
	const createdAt = new Date(version.createdAt)
	const when = t('program.versions.when', {
		date: formatDayMonth(createdAt),
		time: formatTime(createdAt),
	})
	return version.isCurrent ? t('program.versions.currentWhen', { when }) : when
}

/**
 * «Програму створено: 2 тренування, по черзі.» The version keeps no snapshot, so the numbers are
 * told only when `program` is the program as it was made (the only version); otherwise «Програму створено.».
 */
export const formatProgramCreated = (
	program: Pick<ProgramResponse, 'templates' | 'mode'> | null,
	t: TFunction,
): string =>
	program === null
		? t('program.versions.createdPlain')
		: t('program.versions.created', {
				templates: t('program.templateCount', { count: program.templates.length }),
				mode: t(`program.mode.${program.mode}`).toLocaleLowerCase(),
			})

/**
 * «Все тіло · по черзі · 3 рази на тиждень · наступне — А»: the line under the title of the view
 * card; the parts the program has no value for are skipped.
 */
export const formatProgramViewSubtitle = (
	view: Pick<ProgramView, 'program' | 'nextTemplateKey'>,
	t: TFunction,
): string => {
	const { program, nextTemplateKey } = view
	const next = program.templates.find((template) => template.key === nextTemplateKey)
	return [
		program.title,
		t(`program.mode.${program.mode}`).toLocaleLowerCase(),
		program.perWeek === null ? null : t('program.perWeek', { count: program.perWeek }),
		next === undefined ? null : `${t('program.screen.next')} — ${getTemplateShortLabel(next.name)}`,
	]
		.filter((part): part is string => part !== null)
		.join(DETAIL_SEPARATOR)
}
