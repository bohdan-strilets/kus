/**
 * full — the greeting and the day card; compact — scrolled up into the history (a tap opens
 * «Сьогодні», mockups/chat-compact.html); focused — the keyboard is up and takes half the screen,
 * a tap on the bar expands the header without closing the keyboard.
 */
export type ChatHeaderMode = 'full' | 'compact' | 'focused'

interface HeaderModeParams {
	isScrolledUp: boolean
	isComposerFocused: boolean
	/** The user tapped the bar while typing; lasts until the field takes focus again. */
	isExpandedByTap: boolean
}

export const getHeaderMode = ({
	isScrolledUp,
	isComposerFocused,
	isExpandedByTap,
}: HeaderModeParams): ChatHeaderMode => {
	if (isScrolledUp) return 'compact'
	if (isComposerFocused && !isExpandedByTap) return 'focused'
	return 'full'
}
