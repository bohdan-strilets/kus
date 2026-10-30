import { useSyncExternalStore } from 'react'

import { NO_VIEWPORT_BOX, type ViewportBox } from './viewport-box'
import {
	getBoxSnapshot,
	getFocusInAtSnapshot,
	getKeyboardPxSnapshot,
	subscribeToViewport,
} from './viewport-store'

export { requestViewportResync } from './viewport-store'

/** The visible box of the screen, live: the app is sized to it so the keyboard never covers it. */
export const useViewportBox = (): ViewportBox =>
	useSyncExternalStore(subscribeToViewport, getBoxSnapshot, () => NO_VIEWPORT_BOX)

/** px the on-screen keyboard takes: the full screen height minus the visual viewport. */
export const useKeyboardPx = (): number =>
	useSyncExternalStore(subscribeToViewport, getKeyboardPxSnapshot, () => 0)

/** performance.now() of the last focus into a text field; null while none has focus. */
export const useFieldFocusInAt = (): number | null =>
	useSyncExternalStore(subscribeToViewport, getFocusInAtSnapshot, () => null)
