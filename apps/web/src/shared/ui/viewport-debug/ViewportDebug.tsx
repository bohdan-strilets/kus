import { useEffect, useState } from 'react'

import { useIsTextFieldFocused } from '@/shared/lib'

import {
	formatDebugLines,
	DEBUG_TOGGLE_EVENT,
	getFlagStorage,
	resolveViewportDebugFlag,
	type ViewportDebugSnapshot,
} from './viewport-debug.lib'

const REFRESH_INTERVAL_MS = 250

export interface ViewportDebugProps {
	/** The same flag AppLayout hides the bottom nav with. */
	isNavHidden: boolean
}

interface EventStamp {
	at: number | null
	count: number
}

const EMPTY_STAMP: EventStamp = { at: null, count: 0 }

const stamp = (previous: EventStamp): EventStamp => ({ at: Date.now(), count: previous.count + 1 })

const DebugPanel = ({ isNavHidden }: ViewportDebugProps) => {
	const isFieldFocused = useIsTextFieldFocused()
	const [resize, setResize] = useState<EventStamp>(EMPTY_STAMP)
	const [scroll, setScroll] = useState<EventStamp>(EMPTY_STAMP)
	// innerHeight changes without a visualViewport event: re-read it on a slow tick
	const [, setTick] = useState(0)

	useEffect(() => {
		const viewport = window.visualViewport
		const onResize = (): void => {
			setResize(stamp)
		}
		const onScroll = (): void => {
			setScroll(stamp)
		}
		viewport?.addEventListener('resize', onResize)
		viewport?.addEventListener('scroll', onScroll)
		const timer = setInterval(() => {
			setTick((tick) => tick + 1)
		}, REFRESH_INTERVAL_MS)
		return () => {
			viewport?.removeEventListener('resize', onResize)
			viewport?.removeEventListener('scroll', onScroll)
			clearInterval(timer)
		}
	}, [])

	const viewport = window.visualViewport
	const snapshot: ViewportDebugSnapshot = {
		innerHeight: window.innerHeight,
		vvHeight: viewport?.height ?? null,
		vvTop: viewport?.offsetTop ?? null,
		vvScale: viewport?.scale ?? null,
		isFieldFocused,
		isNavHidden,
		resizeAt: resize.at,
		resizeCount: resize.count,
		scrollAt: scroll.at,
		scrollCount: scroll.count,
	}

	return (
		<div
			aria-hidden="true"
			className="pointer-events-none fixed top-safe-top left-0 z-70 bg-ink px-2 py-1 font-mono text-small leading-tight text-surface"
		>
			{formatDebugLines(snapshot).map((line) => (
				<div key={line}>{line}</div>
			))}
		</div>
	)
}

/** Only numbers and flags, no content. Renders nothing (one toggle listener) unless the flag is on. */
export const ViewportDebug = ({ isNavHidden }: ViewportDebugProps) => {
	const [isEnabled, setIsEnabled] = useState(() =>
		resolveViewportDebugFlag(window.location.search, getFlagStorage()),
	)

	useEffect(() => {
		const onToggle = (event: Event): void => {
			if (event instanceof CustomEvent && typeof event.detail === 'boolean') {
				setIsEnabled(event.detail)
			}
		}
		window.addEventListener(DEBUG_TOGGLE_EVENT, onToggle)
		return () => {
			window.removeEventListener(DEBUG_TOGGLE_EVENT, onToggle)
		}
	}, [])

	if (!isEnabled) return null
	return <DebugPanel isNavHidden={isNavHidden} />
}
