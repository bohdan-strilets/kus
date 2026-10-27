import { STATS_CARD_MIN_LOGGED_DAYS, type StatsCard } from '@kus/shared'
import type { TFunction } from 'i18next'

import {
	formatDayMonth,
	formatDecimal,
	formatInteger,
	formatShortDate,
	formatWeekdayShort,
	toCalendarDate,
} from '@/shared/lib'

const MS_IN_DAY = 24 * 60 * 60 * 1000
const MONDAY = 1
const SUNDAY = 0
const DAYS_IN_WEEK = 7
const DAYS_IN_MONTH_PERIOD = 30

export interface StatsCardView {
	title: string
	/** Exact dates under the title, or «понеділок – неділя» for a whole calendar week; empty when the title has the dates. */
	subtitle: string
	/** Fewer than STATS_CARD_MIN_LOGGED_DAYS days with entries: no averages. */
	isSparse: boolean
	/** Days from the first to the last, both included. */
	totalDays: number
	/** «серед днів із записами» under «19 з 26»: only for a period longer than a week with a day without entries. */
	hasLoggedDaysCaption: boolean
	/** «140 г» under the protein average; null without a protein goal. */
	proteinGoal: string | null
	/** «84,0 → 82,4» under the weight change; null with fewer than two weigh-ins. */
	weightRange: string | null
	/** «Нд, 18.10» and «2 380 ккал» per day with entries, oldest first (the sparse card lists them). */
	dayRows: StatsCardDayRow[]
}

export interface StatsCardDayRow {
	date: string
	label: string
	kcal: string
}

const getTotalDays = (from: string, to: string): number =>
	Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_IN_DAY) + 1

const getProteinGoal = (card: StatsCard, t: TFunction): string | null =>
	card.proteinGoalG === null ? null : `${formatInteger(card.proteinGoalG)}${t('macro.grams')}`

const getWeightRange = ({ weightStartKg, weightEndKg }: StatsCard, t: TFunction): string | null =>
	weightStartKg === null || weightEndKg === null
		? null
		: t('chat.statsCard.weightFromTo', {
				from: formatDecimal(weightStartKg),
				to: formatDecimal(weightEndKg),
			})

const getDayRows = ({ days }: StatsCard, t: TFunction): StatsCardDayRow[] =>
	days.map(({ date, kcal }) => {
		const calendarDate = toCalendarDate(date)
		return {
			date,
			label: t('chat.statsCard.dayLine', {
				weekday: formatWeekdayShort(calendarDate),
				date: formatShortDate(calendarDate),
			}),
			kcal: t('chat.statsCard.dayKcal', { kcal: formatInteger(kcal) }),
		}
	})

/** «5–11 жовтня» inside a month, «28 вересня – 4 жовтня» across two. */
const formatRange = (from: string, to: string, t: TFunction): string => {
	const fromDate = toCalendarDate(from)
	const toDate = toCalendarDate(to)
	if (
		fromDate.getMonth() === toDate.getMonth() &&
		fromDate.getFullYear() === toDate.getFullYear()
	) {
		return `${fromDate.getDate()}–${formatDayMonth(toDate)}`
	}
	return t('chat.statsCard.dateRange', {
		from: formatDayMonth(fromDate),
		to: formatDayMonth(toDate),
	})
}

const isCalendarWeek = (from: string, to: string): boolean =>
	toCalendarDate(from).getDay() === MONDAY &&
	toCalendarDate(to).getDay() === SUNDAY &&
	getTotalDays(from, to) === DAYS_IN_WEEK

/**
 * The heading of a stats card (mockups/chat-stats-card.html, chat-stats-period.html): «За 30 днів» and
 * «За 7 днів» with the dates under them, «Тиждень 5–11 жовтня» for a finished Monday–Sunday week;
 * any other length is one line, «15 днів · 12.10–26.10» (the subtitle is empty). The length is counted
 * from the dates, so a card stored before `periodDays` reads the same. `today` is the user's `YYYY-MM-DD`.
 */
export const getStatsCardView = (card: StatsCard, today: string, t: TFunction): StatsCardView => {
	const { from, to, loggedDays } = card
	const range = formatRange(from, to, t)
	const totalDays = getTotalDays(from, to)
	const base = {
		isSparse: loggedDays < STATS_CARD_MIN_LOGGED_DAYS,
		totalDays,
		hasLoggedDaysCaption: totalDays > DAYS_IN_WEEK && loggedDays < totalDays,
		proteinGoal: getProteinGoal(card, t),
		weightRange: getWeightRange(card, t),
		dayRows: getDayRows(card, t),
	}
	if (to < today && isCalendarWeek(from, to)) {
		return {
			...base,
			title: t('chat.statsCard.week', { range }),
			subtitle: t('chat.statsCard.weekRange'),
		}
	}
	if (totalDays === DAYS_IN_WEEK || totalDays === DAYS_IN_MONTH_PERIOD) {
		return { ...base, title: t('chat.statsCard.lastDays', { count: totalDays }), subtitle: range }
	}
	return {
		...base,
		title: t('chat.statsCard.periodTitle', {
			count: totalDays,
			from: formatShortDate(toCalendarDate(from)),
			to: formatShortDate(toCalendarDate(to)),
		}),
		subtitle: '',
	}
}
