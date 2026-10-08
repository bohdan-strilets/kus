import { MESSAGE_TEXT_MAX_LENGTH } from '@kus/shared'
import { useState } from 'react'

import { useLocalToday } from '@/entities/day'
import { useSessionUser } from '@/entities/session'
import { Composer, useSendMessage } from '@/features/send-message'
import { FEATURES } from '@/shared/config'
import { ChatFeed } from '@/widgets/chat-feed'
import { ChatHeader } from '@/widgets/chat-header'

/** The main screen (design/docs/screens.md → Чат): header with the day, the feed, the composer. */
export const ChatPage = () => {
	const user = useSessionUser()
	// the session guard renders /app only with a user; this keeps the types honest
	if (!user) return null
	return <ChatScreen userName={user.name ?? ''} timeZone={user.timezone} />
}

const ChatScreen = ({ userName, timeZone }: { userName: string; timeZone: string }) => {
	const today = useLocalToday(timeZone)
	const [isCompact, setIsCompact] = useState(false)
	const [text, setText] = useState('')
	const { send } = useSendMessage()

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<ChatHeader userName={userName} timeZone={timeZone} today={today} isCompact={isCompact} />
			<ChatFeed
				userName={userName}
				timeZone={timeZone}
				today={today}
				onCompactChange={setIsCompact}
			/>
			<div className="px-gutter pb-2.5">
				<Composer
					value={text}
					onValueChange={setText}
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
