import type { TFunction } from 'i18next'

import { formatWeekdayLong, shiftLocalDate, toCalendarDate } from '@/shared/lib'

/** «Сьогодні», «Вчора», else the weekday — the date itself is the line above the title. */
export const getDayTitle = ({
	localDate,
	today,
	t,
}: {
	localDate: string
	today: string
	t: TFunction
}): string => {
	if (localDate === today) return t('today.title.today')
	if (localDate === shiftLocalDate(today, -1)) return t('today.title.yesterday')
	return formatWeekdayLong(toCalendarDate(localDate))
}
