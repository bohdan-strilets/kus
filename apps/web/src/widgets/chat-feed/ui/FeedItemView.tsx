import { useTranslation } from 'react-i18next'

import { DayDivider, TimeDivider, TypingIndicator } from '@/entities/message'
import { formatDayHeading, formatTime, toCalendarDate } from '@/shared/lib'

import type { FeedDismiss, FeedItem, RetryParams } from '../model/feed.types'
import { KusikReply } from './KusikReply'
import { NewDayGreeting } from './NewDayGreeting'
import { SendFailure } from './SendFailure'
import { UserMessage } from './UserMessage'
import { YesterdayRecap } from './YesterdayRecap'

interface FeedItemViewProps {
	item: FeedItem
	isLatestReply: boolean
	/** `YYYY-MM-DD` in the user's timezone. */
	today: string
	onRetry: (params: RetryParams) => void
	onDismiss: (dismiss: FeedDismiss) => void
}

export const FeedItemView = ({
	item,
	isLatestReply,
	today,
	onRetry,
	onDismiss,
}: FeedItemViewProps) => {
	const { t } = useTranslation()

	switch (item.kind) {
		case 'day': {
			const labels = { today: t('chat.today'), yesterday: t('chat.yesterday') }
			const label =
				item.label === 'date'
					? formatDayHeading(toCalendarDate(item.localDate))
					: labels[item.label]
			return <DayDivider label={label} isToday={item.label === 'today'} />
		}
		case 'time':
			return <TimeDivider time={formatTime(new Date(item.at))} />
		case 'greeting':
			return <NewDayGreeting />
		case 'recap':
			return <YesterdayRecap localDate={item.localDate} />
		case 'user':
			return <UserMessage item={item} />
		case 'kusik':
			return (
				<KusikReply
					message={item.message}
					isLatest={isLatestReply}
					today={today}
					photoStatus={item.photoStatus}
					isFromOnboarding={item.isFromOnboarding}
				/>
			)
		case 'failure':
			return (
				<SendFailure
					error={item.error}
					retry={item.retry}
					dismiss={item.dismiss}
					staleSince={item.staleSince}
					onRetry={onRetry}
					onDismiss={onDismiss}
				/>
			)
		case 'typing':
			return <TypingIndicator phase={item.phase} />
	}
}
