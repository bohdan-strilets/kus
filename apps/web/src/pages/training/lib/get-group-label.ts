import type { TFunction } from 'i18next'

import { formatDayMonth, formatWeekdayLong, getDayRelation, toCalendarDate } from '@/shared/lib'

/** «Сьогодні · 26 жовтня», «Вчора · 25 жовтня», «Пʼятниця · 23 жовтня». */
export const getGroupLabel = (localDate: string, today: string, t: TFunction): string => {
	const date = toCalendarDate(localDate)
	const relation = getDayRelation(localDate, today)
	const day =
		relation === 'today' || relation === 'yesterday'
			? t(`training.day.${relation}`)
			: formatWeekdayLong(date)
	return t('training.day.label', { day, date: formatDayMonth(date) })
}
