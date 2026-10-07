import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib'
import { Badge } from '@/shared/ui'

import { type MessageBubbleVariantProps, messageBubbleVariants } from './message-bubble.variants'

export type MessageBubbleProps = MessageBubbleVariantProps & {
	/** Text (rendered as text, never HTML) and, for Kusik, cards inside the bubble. */
	children: ReactNode
	/** The user's message didn't reach the server (chat-error): faded, «Не надіслано» under it. */
	isFailed?: boolean
	className?: string
}

/** A chat bubble. Place Kusik's inside KusikRow so the head sits next to it. */
export const MessageBubble = ({
	author = 'kusik',
	tone,
	isFailed = false,
	className,
	children,
}: MessageBubbleProps) => {
	const { t } = useTranslation()
	const bubble = (
		<div
			className={cn(
				messageBubbleVariants({ author, tone }),
				isFailed && 'max-w-full opacity-75',
				author === 'user' && !isFailed && 'self-end',
				className,
			)}
		>
			{children}
		</div>
	)

	if (!isFailed) return bubble

	return (
		<div className="flex max-w-4/5 flex-col items-end gap-1 self-end">
			{bubble}
			<Badge variant="failed">{t('chat.notSent')}</Badge>
		</div>
	)
}
