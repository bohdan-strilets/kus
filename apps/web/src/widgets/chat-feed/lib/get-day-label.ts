import type { TFunction } from 'i18next'

import { formatShortDate, formatWeekdayShort, getDayRelation, toCalendarDate } from '@/shared/lib'

/**
 * The plate over a meal card that is not about today: «На завтра, 19.10», «Вчора, 17.10»,
 * «Пт, 16.10». null for today — that card stays as it was.
 */
export const getDayBadgeLabel = (localDate: string, today: string, t: TFunction): string | null => {
	const relation = getDayRelation(localDate, today)
	if (relation === 'today') return null
	const date = formatShortDate(toCalendarDate(localDate))
	if (relation === 'tomorrow') return t('chat.otherDay.tomorrow', { date })
	if (relation === 'yesterday') return t('chat.otherDay.yesterday', { date })
	return t('chat.otherDay.weekday', {
		weekday: formatWeekdayShort(toCalendarDate(localDate)),
		date,
	})
}

/** The heading of a day card: «Сьогодні», «Завтра, 19.10», «Вчора, 17.10», «Пт, 16.10». */
export const getDayCardTitle = (localDate: string, today: string, t: TFunction): string => {
	const relation = getDayRelation(localDate, today)
	if (relation === 'today') return t('chat.dayCard.today')
	const date = formatShortDate(toCalendarDate(localDate))
	if (relation === 'tomorrow') return t('chat.dayCard.tomorrow', { date })
	if (relation === 'yesterday') return t('chat.dayCard.yesterday', { date })
	return t('chat.dayCard.weekday', { weekday: formatWeekdayShort(toCalendarDate(localDate)), date })
}
