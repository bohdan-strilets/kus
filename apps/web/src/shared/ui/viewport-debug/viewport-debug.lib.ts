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
 * ?debug=viewport turns the overlay on for the session (it survives in-app navigation),
 * ?debug=off turns it off; without the param the session flag decides. Storage may throw or be
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

export const getSessionStorage = (): FlagStorage | null => {
	try {
		return window.sessionStorage
	} catch {
		return null
	}
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
