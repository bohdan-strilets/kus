export interface ComposerVoiceState {
	elapsedSeconds: number
	/** Bar heights in px (6…30) sampled every 90 ms from the mic level. */
	levels: readonly number[]
	onCancel: () => void
	onStop: () => void
}

export interface ComposerPhotoState {
	status: 'idle' | 'processing' | 'ready' | 'error'
	previewUrl: string | null
	/** i18n key of what went wrong with the picked file. */
	errorKey: 'chat.photoUnsupported' | 'chat.photoTooLarge' | null
	onRemove: () => void
}

export interface ComposerProps {
	value: string
	/** Defaults to «Напиши, що з'їв, або спитай…»; onboarding passes its own example. */
	placeholder?: string
	onValueChange: (value: string) => void
	onSubmit: () => void
	/** The field took or lost focus — the chat header collapses while the keyboard is up. */
	onFocusChange?: (isFocused: boolean) => void
	/** A file chosen with the camera button (the system sheet offers camera or gallery). */
	onPhotoPick?: (file: File) => void
	onVoiceStart?: () => void
	/** Off: no camera button (FEATURES.photo). */
	isPhotoEnabled?: boolean
	/** Off: the right slot is always «Надіслати», inactive while the field is empty (FEATURES.voice). */
	isVoiceEnabled?: boolean
	/** The picked photo: a thumbnail above the field, or why it can't be used. */
	photo?: ComposerPhotoState
	/** The API limit for one message. */
	maxLength?: number
	/** While recording, the field becomes the wave (mockups/chat-voice.html). */
	voice?: ComposerVoiceState
}
