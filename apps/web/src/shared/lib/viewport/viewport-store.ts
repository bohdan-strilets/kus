import { getKeyboardPx, getNextFullHeight } from './keyboard-state'
import { isTextField } from './use-text-field-focus'
import { getNextViewportBox, NO_VIEWPORT_BOX, type ViewportBox } from './viewport-box'
import {
	advanceSettle,
	type SettleProgress,
	startSettle,
	VIEWPORT_SETTLE_MAX_MS,
} from './viewport-settle'

// iOS Safari doesn't shrink the layout viewport for the keyboard (interactive-widget isn't in a
// public Safari yet): only visualViewport knows how much of the screen is left above it.
// One store for the whole app: the box, the keyboard height and the focus time share one settle loop.
let box: ViewportBox = NO_VIEWPORT_BOX
let fullHeight: number | null = null
let isReseeding = false
let focusInAt: number | null = null
let lastFocusOutAt = Number.NEGATIVE_INFINITY

interface SettleLoop {
	progress: SettleProgress
	signature: string
	frameId: number | null
}
let loop: SettleLoop | null = null

const listeners = new Set<() => void>()

const emit = (): void => {
	for (const listener of [...listeners]) listener()
}

const sync = (): void => {
	const viewport = window.visualViewport
	box = getNextViewportBox(box, viewport)
	if (!viewport) return
	fullHeight = getNextFullHeight({
		previous: fullHeight,
		height: Math.round(viewport.height),
		scale: viewport.scale,
		isFieldFocused: isTextField(document.activeElement),
		isReseeding,
	})
}

const getSignature = (): string =>
	`${box.height}|${box.offsetTop}|${getKeyboardPx(fullHeight, box.height)}`

const runFrame = (): void => {
	if (!loop) return
	loop.frameId = null
	sync()
	const signature = getSignature()
	const hasChanged = signature !== loop.signature
	if (hasChanged) {
		loop.signature = signature
		emit()
	}
	const step = advanceSettle(loop.progress, { now: performance.now(), hasChanged })
	loop.progress = step.progress
	if (step.isDone) {
		loop = null
		isReseeding = false
		return
	}
	loop.frameId = requestAnimationFrame(runFrame)
}

/** Re-reads now, then keeps reading every frame until the box stops moving; a new trigger extends it. */
const trigger = (): void => {
	sync()
	emit()
	const frameId = loop?.frameId ?? null
	loop = { progress: startSettle(performance.now()), signature: getSignature(), frameId }
	if (frameId === null) loop.frameId = requestAnimationFrame(runFrame)
}

/** For code that changes what the viewport will show (a picker closing): poll until it settles. */
export const requestViewportResync = (): void => {
	trigger()
}

const onResume = (): void => {
	if (document.visibilityState === 'hidden') return
	trigger()
}

const onFocusIn = (): void => {
	focusInAt = isTextField(document.activeElement) ? performance.now() : null
	trigger()
}

const onFocusOut = (): void => {
	focusInAt = null
	lastFocusOutAt = performance.now()
	trigger()
}

const onOrientationChange = (): void => {
	isReseeding = true
	fullHeight = null
	onResume()
}

const onWindowResize = (): void => {
	// right after blur the window may still be shrunk by the closing keyboard: not a new full height
	const isJustBlurred = performance.now() - lastFocusOutAt < VIEWPORT_SETTLE_MAX_MS
	if (!isTextField(document.activeElement) && !isJustBlurred) {
		isReseeding = true
		fullHeight = null
	}
	trigger()
}

const attach = (viewport: VisualViewport): void => {
	focusInAt = isTextField(document.activeElement) ? performance.now() : null
	viewport.addEventListener('resize', trigger)
	viewport.addEventListener('scroll', trigger)
	document.addEventListener('focusin', onFocusIn)
	document.addEventListener('focusout', onFocusOut)
	document.addEventListener('visibilitychange', onResume)
	window.addEventListener('pageshow', onResume)
	window.addEventListener('focus', onResume)
	window.addEventListener('resize', onWindowResize)
	window.addEventListener('orientationchange', onOrientationChange)
}

const detach = (viewport: VisualViewport): void => {
	viewport.removeEventListener('resize', trigger)
	viewport.removeEventListener('scroll', trigger)
	document.removeEventListener('focusin', onFocusIn)
	document.removeEventListener('focusout', onFocusOut)
	document.removeEventListener('visibilitychange', onResume)
	window.removeEventListener('pageshow', onResume)
	window.removeEventListener('focus', onResume)
	window.removeEventListener('resize', onWindowResize)
	window.removeEventListener('orientationchange', onOrientationChange)
	if (loop?.frameId != null) cancelAnimationFrame(loop.frameId)
	loop = null
	isReseeding = false
}

export const subscribeToViewport = (listener: () => void): (() => void) => {
	const viewport = window.visualViewport
	if (!viewport) return () => undefined
	listeners.add(listener)
	if (listeners.size === 1) attach(viewport)
	return () => {
		listeners.delete(listener)
		if (listeners.size === 0) detach(viewport)
	}
}

export const getBoxSnapshot = (): ViewportBox => {
	sync()
	return box
}

export const getKeyboardPxSnapshot = (): number => {
	sync()
	return getKeyboardPx(fullHeight, box.height)
}

export const getFocusInAtSnapshot = (): number | null => focusInAt
