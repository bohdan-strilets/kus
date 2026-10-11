import { useTranslation } from 'react-i18next'

import { MessageBubble } from '@/entities/message'
import { Icon, ICON_SIZE, ProgressBar } from '@/shared/ui'

import type { FeedItem } from '../model/feed.types'

type UserFeedItem = Extract<FeedItem, { kind: 'user' }>

const PHOTO_TEXT_PADDING = 'px-2.75 py-1.5'

/**
 * The user's bubble: words, or a photo with the words under it (mockups/chat-photo.html: padding
 * 4, the picture 220×150 with radius 16). A photo this device no longer has is a «Фото» row; the
 * bar under the picture is how much of it has reached the server.
 */
export const UserMessage = ({ item }: { item: UserFeedItem }) => {
	const { t } = useTranslation()
	const { photo, text, state, uploadProgress } = item

	if (!photo) {
		return (
			<MessageBubble author="user" isFailed={state === 'failed'}>
				{text}
			</MessageBubble>
		)
	}

	return (
		<MessageBubble author="user" isFailed={state === 'failed'} className="p-1">
			{photo.kind === 'preview' ? (
				<img
					src={photo.url}
					alt={t('chat.photoAlt')}
					className="block max-h-37.5 max-w-55 rounded-tile object-cover"
				/>
			) : (
				<span className={`flex items-center gap-2 ${PHOTO_TEXT_PADDING}`}>
					<Icon name="image" size={ICON_SIZE.control} />
					{t('chat.photoPlaceholder')}
				</span>
			)}
			{state === 'sending' && uploadProgress !== undefined && uploadProgress < 1 && (
				<ProgressBar
					value={uploadProgress}
					max={1}
					label={t('chat.uploadProgress')}
					track="white"
					className="mx-2 mt-1.5 mb-1"
				/>
			)}
			{text && <p className={PHOTO_TEXT_PADDING}>{text}</p>}
		</MessageBubble>
	)
}
