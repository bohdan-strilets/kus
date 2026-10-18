import { MESSAGE_TEXT_MAX_LENGTH } from '@kus/shared'

import { useLocalToday } from '@/entities/day'
import { useSessionUser } from '@/entities/session'
import type { Addressee } from '@/entities/user'
import { EditEntrySheet } from '@/features/edit-entry'
import { EditMeasurementSheet } from '@/features/edit-measurement'
import {
	Composer,
	QuickChips,
	shouldShowQuickChips,
	useComposerDraftStore,
	useIsPhotoBlocked,
	usePhotoDraftStore,
	useSendMessage,
} from '@/features/send-message'
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
	// survives a switch of tabs and a reload of the PWA; claimed per user with the session
	const text = useComposerDraftStore((state) => state.text)
	const setText = useComposerDraftStore((state) => state.setText)
	const clearText = useComposerDraftStore((state) => state.clear)
	const isFocusRequested = useComposerDraftStore((state) => state.isFocusRequested)
	const resolveFocus = useComposerDraftStore((state) => state.resolveFocus)
	const scrollToEndRequest = useComposerDraftStore((state) => state.scrollToEndRequest)
	const requestScrollToEnd = useComposerDraftStore((state) => state.requestScrollToEnd)
	const handleFocusChange = (isFocused: boolean): void => {
		header.onComposerFocusChange(isFocused)
		if (isFocused) requestScrollToEnd()
	}
	const photoDraft = usePhotoDraftStore()
	const isPhotoBlocked = useIsPhotoBlocked()
	const { send } = useSendMessage()
	const features: Record<keyof typeof FEATURES, boolean> = FEATURES
	const hasQuickChips = shouldShowQuickChips({
		isEnabled: features.quickChips,
		draftText: text,
		photoStatus: photoDraft.status,
	})

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
				scrollToEndRequest={scrollToEndRequest}
			/>
			<div className="px-gutter pb-2.5">
				<QuickChips isShown={hasQuickChips} />
				<Composer
					value={text}
					onValueChange={setText}
					onFocusChange={handleFocusChange}
					onFieldPress={requestScrollToEnd}
					onSubmit={() => {
						send({ text, photo: photoDraft.photo })
						clearText()
						photoDraft.clear()
					}}
					onPhotoPick={(file) => void photoDraft.pick(file)}
					photo={{
						status: photoDraft.status,
						previewUrl: photoDraft.photo?.previewUrl ?? null,
						errorKey: photoDraft.errorKey,
						onRemove: photoDraft.clear,
					}}
					isPhotoEnabled={FEATURES.photo}
					isPhotoBlocked={isPhotoBlocked}
					isVoiceEnabled={FEATURES.voice}
					maxLength={MESSAGE_TEXT_MAX_LENGTH}
					shouldFocus={isFocusRequested}
					onFocusHandled={resolveFocus}
				/>
			</div>
			<EditEntrySheet />
			<EditMeasurementSheet />
		</div>
	)
}
