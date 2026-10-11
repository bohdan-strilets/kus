import { useTranslation } from 'react-i18next'

import { KusikRow, MessageBubble } from '@/entities/message'
import type { SendError } from '@/features/send-message'
import { Button, Icon, ICON_SIZE, Text } from '@/shared/ui'

import type { RetryParams } from '../model/feed.types'

interface SendFailureProps {
	error: SendError
	/** null when resending the same text can't help (too long, the daily limit). */
	retry: RetryParams | null
	/** A photo that is gone can only be removed from the feed. */
	dismiss: { clientMessageId: string } | null
	onRetry: (params: RetryParams) => void
	onDismiss: (clientMessageId: string) => void
}

/** Kusik's «ой» under a message that didn't go through (mockups/chat-error.html). */
export const SendFailure = ({ error, retry, dismiss, onRetry, onDismiss }: SendFailureProps) => {
	const { t } = useTranslation()

	return (
		<KusikRow kind="error">
			<MessageBubble tone="error">
				<Text>{t(error.messageKey)}</Text>
				{dismiss && (
					<Button
						variant="secondary"
						size="md"
						className="self-start"
						onClick={() => {
							onDismiss(dismiss.clientMessageId)
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
						{t('chat.retry')}
					</Button>
				)}
			</MessageBubble>
		</KusikRow>
	)
}
