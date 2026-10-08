import { useState } from 'react'

import { type ChatHeaderMode, getHeaderMode } from '../lib/get-header-mode'

export interface ChatHeaderModeState {
	mode: ChatHeaderMode
	onScrolledUpChange: (isScrolledUp: boolean) => void
	onComposerFocusChange: (isFocused: boolean) => void
	/** A tap on the bar while typing. */
	expand: () => void
}

export const useChatHeaderMode = (): ChatHeaderModeState => {
	const [isScrolledUp, setIsScrolledUp] = useState(false)
	const [isComposerFocused, setIsComposerFocused] = useState(false)
	const [isExpandedByTap, setIsExpandedByTap] = useState(false)

	return {
		mode: getHeaderMode({ isScrolledUp, isComposerFocused, isExpandedByTap }),
		onScrolledUpChange: setIsScrolledUp,
		onComposerFocusChange: (isFocused) => {
			setIsComposerFocused(isFocused)
			// typing again after an expand collapses the header again
			if (isFocused) setIsExpandedByTap(false)
		},
		expand: () => {
			setIsExpandedByTap(true)
		},
	}
}
