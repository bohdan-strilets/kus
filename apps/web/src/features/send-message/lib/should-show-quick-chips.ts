interface ShouldShowQuickChipsOptions {
	isEnabled: boolean
	draftText: string
}

/**
 * The chips start an empty message: with text already there they would be in the way. A picked
 * photo doesn't hide them (mockups/chat-photo-preview.html keeps them over the field).
 */
export const shouldShowQuickChips = ({
	isEnabled,
	draftText,
}: ShouldShowQuickChipsOptions): boolean => isEnabled && draftText.trim() === ''
