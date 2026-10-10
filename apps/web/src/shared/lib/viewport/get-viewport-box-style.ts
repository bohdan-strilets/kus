import type { CSSProperties } from 'react'

import type { ViewportBox } from './viewport-box'

/**
 * Sizes a `fixed` layer to the visible part of the screen. iOS doesn't shrink the layout viewport
 * for the keyboard, so a plain `inset-0` layer would sit partly behind it. Without visualViewport
 * (null height) the classes alone (`inset-0` / `h-dvh`) apply.
 */
export const getViewportBoxStyle = (box: ViewportBox): CSSProperties | undefined =>
	box.height === null
		? undefined
		: { height: box.height, transform: `translateY(${box.offsetTop}px)` }
