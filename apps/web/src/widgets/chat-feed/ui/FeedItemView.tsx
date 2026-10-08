import { useTranslation } from 'react-i18next'

import { DayDivider, MessageBubble, TimeDivider, TypingIndicator } from '@/entities/message'
import type { Addressee } from '@/entities/user'
import { formatDayHeading, formatTime, toCalendarDate } from '@/shared/lib'

import type { FeedItem, RetryParams } from '../model/feed.types'
import { KusikReply } from './KusikReply'
import { NewDayGreeting } from './NewDayGreeting'
import { SendFailure } from './SendFailure'
import { YesterdayRecap } from './YesterdayRecap'

interface FeedItemViewProps {
	item: FeedItem
	isLatestReply: boolean
	addressee: Addressee
	timeZone: string
	onRetry: (params: RetryParams) => void
}

export const FeedItemView = ({
	item,
	isLatestReply,
	addressee,
	timeZone,
	onRetry,
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
			return <NewDayGreeting addressee={addressee} timeZone={timeZone} />
		case 'recap':
			return <YesterdayRecap localDate={item.localDate} />
		case 'user':
			return (
				<MessageBubble author="user" isFailed={item.state === 'failed'}>
					{item.text}
				</MessageBubble>
			)
		case 'kusik':
			return <KusikReply message={item.message} isLatest={isLatestReply} />
		case 'failure':
			return <SendFailure error={item.error} retry={item.retry} onRetry={onRetry} />
		case 'typing':
			return <TypingIndicator />
	}
}
