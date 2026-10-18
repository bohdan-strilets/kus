import { useSyncExternalStore } from 'react'

import { getLocalDateString, getLocalHour } from './local-date'

const MINUTE_MS = 60_000

type Listener = () => void

const listeners = new Set<Listener>()
let now = Date.now()
let timer: ReturnType<typeof setTimeout> | null = null

const notify = (): void => {
	for (const listener of listeners) listener()
}

const refresh = (): void => {
	now = Date.now()
	notify()
}

const refreshIfVisible = (): void => {
	if (document.visibilityState !== 'visible') return
	refresh()
}

// Aligned to the minute boundary: midnight is noticed within the first second, not up to a minute late.
const scheduleTick = (): void => {
	timer = setTimeout(
		() => {
			refresh()
			scheduleTick()
		},
		MINUTE_MS - (Date.now() % MINUTE_MS),
	)
}

const start = (): void => {
	now = Date.now()
	scheduleTick()
	document.addEventListener('visibilitychange', refreshIfVisible)
	window.addEventListener('pageshow', refresh)
	window.addEventListener('focus', refresh)
}

const stop = (): void => {
	if (timer !== null) clearTimeout(timer)
	timer = null
	document.removeEventListener('visibilitychange', refreshIfVisible)
	window.removeEventListener('pageshow', refresh)
	window.removeEventListener('focus', refresh)
}

const subscribe = (listener: Listener): (() => void) => {
	if (listeners.size === 0) start()
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
		if (listeners.size === 0) stop()
	}
}

// Without subscribers the stored value would be stale, so read the clock directly.
const getNow = (): Date => new Date(listeners.size === 0 ? Date.now() : now)

/** Today (`YYYY-MM-DD`) in the timezone; one shared clock re-renders only when the day changes. */
export const useLocalDate = (timeZone: string): string =>
	useSyncExternalStore(subscribe, () => getLocalDateString(getNow(), timeZone))

/** Hour 0–23 in the timezone; re-renders only when the hour changes. */
export const useLocalHour = (timeZone: string): number =>
	useSyncExternalStore(subscribe, () => getLocalHour(getNow(), timeZone))
