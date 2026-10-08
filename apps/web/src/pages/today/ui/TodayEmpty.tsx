import { useTranslation } from 'react-i18next'

import { Button, Hamster, Heading, Text } from '@/shared/ui'

const HAMSTER_SIZE = 140

const TEXT_KEYS = {
	today: {
		title: 'today.empty.title',
		text: 'today.empty.text',
		action: 'today.empty.action',
	},
	past: {
		title: 'today.emptyPast.title',
		text: 'today.emptyPast.text',
		action: 'today.emptyPast.action',
	},
} as const

interface TodayEmptyProps {
	/** Today — «Написати в чат»; a past day — back to today (only today takes new food). */
	isToday: boolean
	onAction: () => void
}

/**
 * mockups/today-empty.html: the hungry hamster, what will appear here and one way forward. The decor
 * is the page's, behind the header too (TodayPage).
 */
export const TodayEmpty = ({ isToday, onAction }: TodayEmptyProps) => {
	const { t } = useTranslation()
	const keys = TEXT_KEYS[isToday ? 'today' : 'past']

	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-8 text-center">
			<Hamster mood="hungry" size={HAMSTER_SIZE} />
			<Heading as="h2" level="title">
				{t(keys.title)}
			</Heading>
			<Text tone="mutedStrong">{t(keys.text)}</Text>
			<Button onClick={onAction}>{t(keys.action)}</Button>
		</div>
	)
}
