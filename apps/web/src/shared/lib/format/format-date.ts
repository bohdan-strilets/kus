import { INTL_LOCALE as LOCALE } from './locale'

const capitalize = (text: string): string =>
	text.charAt(0).toLocaleUpperCase(LOCALE) + text.slice(1)

/** «08:40» — meal and message times. */
export const formatTime = (date: Date): string =>
	date.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })

/** «Понеділок, 5 жовтня» — screen and chat header dates. */
export const formatDayHeading = (date: Date): string =>
	capitalize(date.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }))

/** «Понеділок» — the «Сьогодні» title for a day that is neither today nor yesterday. */
export const formatWeekdayLong = (date: Date): string =>
	capitalize(date.toLocaleDateString(LOCALE, { weekday: 'long' }))

/** «Пн» — week strip day labels. */
export const formatWeekdayShort = (date: Date): string =>
	capitalize(date.toLocaleDateString(LOCALE, { weekday: 'short' }))
