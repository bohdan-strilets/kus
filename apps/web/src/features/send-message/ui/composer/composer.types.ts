export interface ComposerVoiceState {
	elapsedSeconds: number
	/** Bar heights in px (6…30) sampled every 90 ms from the mic level. */
	levels: readonly number[]
	onCancel: () => void
	onStop: () => void
}

export interface ComposerProps {
	value: string
	/** Defaults to «Напиши, що з'їв, або спитай…»; onboarding passes its own example. */
	placeholder?: string
	onValueChange: (value: string) => void
	onSubmit: () => void
	/** The field took or lost focus — the chat header collapses while the keyboard is up. */
	onFocusChange?: (isFocused: boolean) => void
	onPhotoClick?: () => void
	onVoiceStart?: () => void
	/** Off: no camera button (FEATURES.photo). */
	isPhotoEnabled?: boolean
	/** Off: the right slot is always «Надіслати», inactive while the field is empty (FEATURES.voice). */
	isVoiceEnabled?: boolean
	/** The API limit for one message. */
	maxLength?: number
	/** While recording, the field becomes the wave (mockups/chat-voice.html). */
	voice?: ComposerVoiceState
}
