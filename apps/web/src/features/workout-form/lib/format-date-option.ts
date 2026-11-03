import type { TFunction } from 'i18next'

import { formatDayMonthShort, formatWeekdayShort, toCalendarDate } from '@/shared/lib'

import type { FormDateOption } from './get-date-options'

/** «Сьогодні», «Вчора», then the day itself: «Чт, 29 жовт». */
export const formatDateOption = (option: FormDateOption, t: TFunction): string => {
	if (option.daysBack === 0) return t('training.form.today')
	if (option.daysBack === 1) return t('training.form.yesterday')
	const date = toCalendarDate(option.localDate)
	return `${formatWeekdayShort(date)}, ${formatDayMonthShort(date)}`
}
