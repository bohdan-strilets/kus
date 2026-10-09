/** The part of the page the user actually sees: above the on-screen keyboard, under Safari's bars. */
export interface ViewportBox {
	/** px; null where visualViewport is missing — the layout falls back to 100dvh. */
	height: number | null
	/** px the visual viewport is scrolled down inside the layout one (iOS pans it to the field). */
	offsetTop: number
}

export const NO_VIEWPORT_BOX: ViewportBox = { height: null, offsetTop: 0 }

/** A pinch beyond this is a zoom, not the keyboard: the visual viewport shrinks by the scale. */
const ZOOM_EPSILON = 0.01

/** Same numbers → the same object, so useSyncExternalStore doesn't re-render for nothing. */
export const isSameBox = (a: ViewportBox, b: ViewportBox): boolean =>
	a.height === b.height && a.offsetTop === b.offsetTop

export const readViewportBox = (viewport: VisualViewport | null | undefined): ViewportBox =>
	viewport
		? { height: Math.round(viewport.height), offsetTop: Math.round(viewport.offsetTop) }
		: NO_VIEWPORT_BOX

/**
 * The box to lay the app out in. While the user pinch-zooms the visual viewport shrinks and pans
 * with the fingers — following it would squeeze the app and pin it under them, so the zoom keeps
 * the last unzoomed box and pans over the app as usual.
 */
export const getNextViewportBox = (
	previous: ViewportBox,
	viewport: VisualViewport | null | undefined,
): ViewportBox => {
	if (viewport && Math.abs(viewport.scale - 1) > ZOOM_EPSILON) return previous
	const next = readViewportBox(viewport)
	return isSameBox(next, previous) ? previous : next
}
