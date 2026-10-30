/**
 * Technical overlay for diagnosing the iPhone keyboard box. Labels and number formats here are not
 * user copy, so they stay out of i18n. To remove the overlay: delete this folder and the one
 * <ViewportDebug /> line in AppLayout.
 */
export const DEBUG_PARAM = 'debug'
export const DEBUG_VIEWPORT_VALUE = 'viewport'
export const DEBUG_OFF_VALUE = 'off'
export const DEBUG_STORAGE_KEY = 'kus.debug.viewport'
const STORAGE_ON = '1'

type FlagStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/**
 * ?debug=viewport turns the overlay on (it survives in-app navigation and, in a home-screen PWA,
 * restarts — there is no address bar there, so five taps on the version in «Налаштування» toggle it
 * too), ?debug=off turns it off; without the param the stored flag decides. Storage may throw or be
 * missing (private window): then the overlay lives only as long as the param is in the URL.
 */
export const resolveViewportDebugFlag = (search: string, storage: FlagStorage | null): boolean => {
	const param = new URLSearchParams(search).get(DEBUG_PARAM)
	try {
		if (param === DEBUG_VIEWPORT_VALUE) {
			storage?.setItem(DEBUG_STORAGE_KEY, STORAGE_ON)
			return true
		}
		if (param === DEBUG_OFF_VALUE) {
			storage?.removeItem(DEBUG_STORAGE_KEY)
			return false
		}
		return storage?.getItem(DEBUG_STORAGE_KEY) === STORAGE_ON
	} catch {
		return param === DEBUG_VIEWPORT_VALUE
	}
}

/** localStorage: the flag outlives a PWA restart until it is turned off. */
export const getFlagStorage = (): FlagStorage | null => {
	try {
		return window.localStorage
	} catch {
		return null
	}
}

/** The overlay listens for this to show or hide itself without a reload. */
export const DEBUG_TOGGLE_EVENT = 'kus:viewport-debug'

/** Flips the stored flag and tells a mounted overlay; returns the new state. */
export const toggleViewportDebug = (storage: FlagStorage | null): boolean => {
	// without storage the flag can't outlive the tap, so there is nothing to toggle
	if (!storage) return false
	try {
		const isEnabled = storage.getItem(DEBUG_STORAGE_KEY) !== STORAGE_ON
		if (isEnabled) storage.setItem(DEBUG_STORAGE_KEY, STORAGE_ON)
		else storage.removeItem(DEBUG_STORAGE_KEY)
		window.dispatchEvent(new CustomEvent<boolean>(DEBUG_TOGGLE_EVENT, { detail: isEnabled }))
		return isEnabled
	} catch {
		return false
	}
}

export const DEBUG_TAPS_TO_TOGGLE = 5
export const DEBUG_TAPS_WINDOW_MS = 3000

/** Tap times kept within the window; `isToggle` once the last N taps fit into it. */
export const registerDebugTap = (
	taps: readonly number[],
	now: number,
): { taps: number[]; isToggle: boolean } => {
	const recent = [...taps.filter((at) => now - at < DEBUG_TAPS_WINDOW_MS), now]
	if (recent.length >= DEBUG_TAPS_TO_TOGGLE) return { taps: [], isToggle: true }
	return { taps: recent, isToggle: false }
}

const pad = (value: number, length: number): string => String(value).padStart(length, '0')

/** HH:MM:SS.mmm in local time; «—» before the first event. */
export const formatDebugTime = (timestamp: number | null): string => {
	if (timestamp === null) return '—'
	const date = new Date(timestamp)
	return `${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}:${pad(date.getSeconds(), 2)}.${pad(date.getMilliseconds(), 3)}`
}

export const formatYesNo = (value: boolean): string => (value ? 'yes' : 'no')

export interface ViewportDebugSnapshot {
	innerHeight: number
	vvHeight: number | null
	vvTop: number | null
	vvScale: number | null
	isFieldFocused: boolean
	isNavHidden: boolean
	resizeAt: number | null
	resizeCount: number
	scrollAt: number | null
	scrollCount: number
}

const formatNumber = (value: number | null): string =>
	value === null ? '—' : String(Math.round(value))

const SCALE_DECIMALS = 100

export const formatDebugLines = (snapshot: ViewportDebugSnapshot): string[] => [
	`innerH ${formatNumber(snapshot.innerHeight)}`,
	`vv.h ${formatNumber(snapshot.vvHeight)}`,
	`vv.top ${formatNumber(snapshot.vvTop)}`,
	`scale ${snapshot.vvScale === null ? '—' : Math.round(snapshot.vvScale * SCALE_DECIMALS) / SCALE_DECIMALS}`,
	`focus ${formatYesNo(snapshot.isFieldFocused)}`,
	`nav hidden ${formatYesNo(snapshot.isNavHidden)}`,
	`resize@ ${formatDebugTime(snapshot.resizeAt)} #${snapshot.resizeCount}`,
	`scroll@ ${formatDebugTime(snapshot.scrollAt)} #${snapshot.scrollCount}`,
]
