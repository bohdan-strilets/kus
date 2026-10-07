export interface ComposerVoiceState {
	elapsedSeconds: number
	/** Bar heights in px (6…30) sampled every 90 ms from the mic level. */
	levels: readonly number[]
	onCancel: () => void
	onStop: () => void
}

export interface ComposerProps {
	value: string
	onValueChange: (value: string) => void
	onSubmit: () => void
	onPhotoClick?: () => void
	onVoiceStart?: () => void
	/** While recording, the field becomes the wave (mockups/chat-voice.html). */
	voice?: ComposerVoiceState
}
