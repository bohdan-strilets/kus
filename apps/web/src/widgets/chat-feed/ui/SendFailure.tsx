import { useTranslation } from 'react-i18next'

import { KusikRow, MessageBubble } from '@/entities/message'
import type { SendError } from '@/features/send-message'
import { Button, Icon, ICON_SIZE, Text } from '@/shared/ui'

import type { RetryParams } from '../model/feed.types'

interface SendFailureProps {
	error: SendError
	/** null when resending the same text can't help (too long, the daily limit). */
	retry: RetryParams | null
	onRetry: (params: RetryParams) => void
}

/** Kusik's «ой» under a message that didn't go through (mockups/chat-error.html). */
export const SendFailure = ({ error, retry, onRetry }: SendFailureProps) => {
	const { t } = useTranslation()

	return (
		<KusikRow kind="error">
			<MessageBubble tone="error">
				<Text>{t(error.messageKey)}</Text>
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
