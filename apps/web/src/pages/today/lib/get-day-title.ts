import type { TFunction } from 'i18next'

import { formatWeekdayLong, getDayRelation, toCalendarDate } from '@/shared/lib'

const TITLE_KEYS = {
	today: 'today.title.today',
	yesterday: 'today.title.yesterday',
	tomorrow: 'todayAhead.title',
} as const

/** «Сьогодні», «Вчора», «Завтра», else the weekday — the date itself is the line above the title. */
export const getDayTitle = ({
	localDate,
	today,
	t,
}: {
	localDate: string
	today: string
	t: TFunction
}): string => {
	const relation = getDayRelation(localDate, today)
	if (relation === 'other') return formatWeekdayLong(toCalendarDate(localDate))
	return t(TITLE_KEYS[relation])
}
