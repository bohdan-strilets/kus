import type { PhotoDraftStatus } from '../model/photo-draft-store'

interface ShouldShowQuickChipsOptions {
	isEnabled: boolean
	draftText: string
	photoStatus: PhotoDraftStatus
}

/** The chips start an empty message: with text or a photo already there they would be in the way. */
export const shouldShowQuickChips = ({
	isEnabled,
	draftText,
	photoStatus,
}: ShouldShowQuickChipsOptions): boolean =>
	isEnabled && draftText.trim() === '' && photoStatus === 'idle'
