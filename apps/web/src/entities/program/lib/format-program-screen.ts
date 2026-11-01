import type { ProgramResponse, ProgramVersionItem } from '@kus/shared'
import type { TFunction } from 'i18next'

import { DETAIL_SEPARATOR } from '@/entities/workout'
import { formatDayMonth, formatTime } from '@/shared/lib'

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
