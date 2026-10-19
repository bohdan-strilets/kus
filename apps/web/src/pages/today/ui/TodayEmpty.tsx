import { ENTRY_BACKDATE_MAX_DAYS, getWeekday, type Weekday } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { Button, Hamster, Heading, Text } from '@/shared/ui'

import type { EmptyDayKind } from '../lib/get-empty-kind'

const HAMSTER_SIZE = 140

const TEXT_KEYS = {
	today: {
		title: 'today.empty.title',
		text: 'today.empty.text',
		action: 'today.empty.action',
	},
	tomorrow: {
		title: 'todayAhead.emptyTomorrow.title',
		text: 'todayAhead.emptyTomorrow.text',
		action: 'today.empty.action',
	},
	recent: {
		title: 'todayAhead.emptyDay.title',
		text: 'todayAhead.emptyRecent.text',
		action: 'today.empty.action',
	},
	old: {
		title: 'todayAhead.emptyDay.title',
		text: 'todayAhead.emptyOld.text',
		action: 'todayAhead.emptyOld.action',
	},
} as const

const WEEKDAY_ON_KEYS = {
	Mon: 'todayAhead.on.Mon',
	Tue: 'todayAhead.on.Tue',
	Wed: 'todayAhead.on.Wed',
	Thu: 'todayAhead.on.Thu',
	Fri: 'todayAhead.on.Fri',
	Sat: 'todayAhead.on.Sat',
	Sun: 'todayAhead.on.Sun',
} as const satisfies Record<Weekday, string>

interface TodayEmptyProps {
	kind: EmptyDayKind
	/** The day on screen, `YYYY-MM-DD`: the «recent» hint names its weekday. */
	localDate: string
	/** Today, tomorrow and recent days — the chat; an old day (no more entries) — back to today. */
	onAction: () => void
}

/**
 * mockups/today-empty.html and today-other-dates.html: the hungry hamster, what will appear here
 * and one way forward. The decor is the page's, behind the header too (TodayPage).
 */
export const TodayEmpty = ({ kind, localDate, onAction }: TodayEmptyProps) => {
	const { t } = useTranslation()
	const keys = TEXT_KEYS[kind]
	const options = {
		days: ENTRY_BACKDATE_MAX_DAYS,
		when: t(WEEKDAY_ON_KEYS[getWeekday(localDate)]),
	}

	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-8 text-center">
			<Hamster mood="hungry" size={HAMSTER_SIZE} />
			<Heading as="h2" level="title">
				{t(keys.title)}
			</Heading>
			<Text tone="mutedStrong">{t(keys.text, options)}</Text>
			<Button onClick={onAction}>{t(keys.action)}</Button>
		</div>
	)
}
