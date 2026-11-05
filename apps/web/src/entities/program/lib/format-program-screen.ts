import type { ProgramResponse, ProgramVersionItem, ProgramView } from '@kus/shared'
import type { TFunction } from 'i18next'

import { DETAIL_SEPARATOR } from '@/entities/workout'
import { formatDayMonth, formatTime } from '@/shared/lib'

import { getTemplateShortLabel } from './format-program-changes'

const SEQUENCE_SEPARATOR = ' → '

/**
 * The hint under «По черзі»: «А → Б → А… Наступне — …» built from the templates in the order of
 * their position (the short names of the journal); one template has no sequence to show.
 */
export const formatRotateHint = (
	templates: readonly Pick<ProgramResponse['templates'][number], 'name' | 'position'>[],
	t: TFunction,
): string => {
	const labels = [...templates]
		.sort((a, b) => a.position - b.position)
		.map((template) => getTemplateShortLabel(template.name))
	const [first] = labels
	if (labels.length < 2 || first === undefined) return t('program.screen.hint.ROTATE_single')
	const sequence = `${[...labels, first].join(SEQUENCE_SEPARATOR)}…`
	return t('program.screen.hint.ROTATE', { sequence })
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
