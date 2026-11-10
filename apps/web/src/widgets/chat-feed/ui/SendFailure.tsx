import { useTranslation } from 'react-i18next'

import { KusikRow, MessageBubble } from '@/entities/message'
import type { SendError } from '@/features/send-message'
import { formatShortDate, toCalendarDate } from '@/shared/lib'
import { Button, Icon, ICON_SIZE, Text } from '@/shared/ui'

import type { FeedDismiss, RetryParams } from '../model/feed.types'

interface SendFailureProps {
	error: SendError
	/** null when resending the same text can't help (too long, the daily limit). */
	retry: RetryParams | null
	/** Every failed message can be removed from the feed. */
	dismiss: FeedDismiss | null
	/** `YYYY-MM-DD` it was written, when it waited over a day: a resend logs it today. */
	staleSince: string | null
	onRetry: (params: RetryParams) => void
	onDismiss: (dismiss: FeedDismiss) => void
}

/** Kusik's «ой» under a message that didn't go through (mockups/chat-error.html). */
export const SendFailure = ({
	error,
	retry,
	dismiss,
	staleSince,
	onRetry,
	onDismiss,
}: SendFailureProps) => {
	const { t } = useTranslation()

	return (
		<KusikRow kind="error">
			<MessageBubble>
				<Text>
					{staleSince
						? t('chat.staleNotSent', { date: formatShortDate(toCalendarDate(staleSince)) })
						: t(error.messageKey)}
				</Text>
				{dismiss && (
					<Button
						variant="secondary"
						size="md"
						className="self-start"
						onClick={() => {
							onDismiss(dismiss)
						}}
					>
						{t('chat.dismiss')}
					</Button>
				)}
				{retry && (
					<Button
						size="md"
						icon={<Icon name="retry" size={ICON_SIZE.control} />}
						className="self-start"
						onClick={() => {
							onRetry(retry)
						}}
					>
						{t(staleSince ? 'chat.sendNow' : 'chat.retry')}
					</Button>
				)}
			</MessageBubble>
		</KusikRow>
	)
}
