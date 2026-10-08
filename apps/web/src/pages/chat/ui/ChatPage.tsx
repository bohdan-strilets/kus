import { MESSAGE_TEXT_MAX_LENGTH } from '@kus/shared'
import { useState } from 'react'

import { useLocalToday } from '@/entities/day'
import { useSessionUser } from '@/entities/session'
import type { Addressee } from '@/entities/user'
import { Composer, useSendMessage } from '@/features/send-message'
import { FEATURES } from '@/shared/config'
import { ChatFeed } from '@/widgets/chat-feed'
import { ChatHeader } from '@/widgets/chat-header'

import { useChatHeaderMode } from '../model/use-chat-header-mode'

/** The main screen (design/docs/screens.md → Чат): header with the day, the feed, the composer. */
export const ChatPage = () => {
	const user = useSessionUser()
	// the session guard renders /app only with a user; this keeps the types honest
	if (!user) return null
	return (
		<ChatScreen
			addressee={{ name: user.name, addressAs: user.addressAs }}
			timeZone={user.timezone}
		/>
	)
}

const ChatScreen = ({ addressee, timeZone }: { addressee: Addressee; timeZone: string }) => {
	const today = useLocalToday(timeZone)
	const header = useChatHeaderMode()
	const [text, setText] = useState('')
	const { send } = useSendMessage()

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<ChatHeader
				addressee={addressee}
				timeZone={timeZone}
				today={today}
				isCompact={header.mode !== 'full'}
				onExpand={header.mode === 'focused' ? header.expand : undefined}
			/>
			<ChatFeed
				addressee={addressee}
				timeZone={timeZone}
				today={today}
				onCompactChange={header.onScrolledUpChange}
			/>
			<div className="px-gutter pb-2.5">
				<Composer
					value={text}
					onValueChange={setText}
					onFocusChange={header.onComposerFocusChange}
					onSubmit={() => {
						send(text)
						setText('')
					}}
					isPhotoEnabled={FEATURES.photo}
					isVoiceEnabled={FEATURES.voice}
					maxLength={MESSAGE_TEXT_MAX_LENGTH}
				/>
			</div>
		</div>
	)
}
