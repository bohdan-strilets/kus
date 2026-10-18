import { useTranslation } from 'react-i18next'

import { MessageBubble, PhotoTile } from '@/entities/message'
import { cn } from '@/shared/lib'
import { Icon, ICON_SIZE, ProgressBar } from '@/shared/ui'

import type { FeedItem } from '../model/feed.types'

type UserFeedItem = Extract<FeedItem, { kind: 'user' }>

const PHOTO_TEXT_PADDING = 'px-2.75 py-1.5'

/**
 * The user's bubble: words, or a photo with the words under it (mockups/photo-history.html:
 * padding 4, the tile 248 wide). A photo the server has no record of is a «Фото» row; the bar
 * under the picture is how much of it has reached the server.
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
			{photo.kind === 'placeholder' ? (
				<span className={cn('flex items-center gap-2', PHOTO_TEXT_PADDING)}>
					<Icon name="image" size={ICON_SIZE.control} />
					{t('chat.photoPlaceholder')}
				</span>
			) : (
				<PhotoTile
					fileId={photo.kind === 'stored' ? photo.fileId : null}
					width={photo.width}
					height={photo.height}
					previewUrl={photo.kind === 'stored' ? photo.previewUrl : photo.url}
					alt={t('chat.photoAlt')}
				/>
			)}
			{state === 'sending' && uploadProgress !== undefined && uploadProgress < 1 && (
				<ProgressBar
					value={uploadProgress}
					max={1}
					track="onBubble"
					label={t('chat.uploadProgress')}
					className="mx-2 mt-1.5 mb-1"
				/>
			)}
			{text && <p className={PHOTO_TEXT_PADDING}>{text}</p>}
		</MessageBubble>
	)
}
