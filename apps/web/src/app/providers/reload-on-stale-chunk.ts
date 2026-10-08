// After a deploy the old hashed chunks are gone: a tab or the installed PWA still running the
// previous version fails to lazy-load a screen. One reload picks up the new index.html.

const LAST_RELOAD_KEY = 'kus:stale-chunk-reload-at'
/** A second failure this soon after reloading is a real outage, not a stale version: no loop. */
const RELOAD_COOLDOWN_MS = 10_000

export const shouldReloadForStaleChunk = (lastReloadAt: number | null, now: number): boolean =>
	lastReloadAt === null || now - lastReloadAt > RELOAD_COOLDOWN_MS

const readLastReloadAt = (): number | null => {
	try {
		const value = Number(sessionStorage.getItem(LAST_RELOAD_KEY))
		return Number.isFinite(value) && value > 0 ? value : null
	} catch {
		// storage blocked (private mode): without the mark, the cooldown can't be kept — don't loop
		return Date.now()
	}
}

const writeLastReloadAt = (now: number): void => {
	try {
		sessionStorage.setItem(LAST_RELOAD_KEY, String(now))
	} catch {
		// nothing to keep; readLastReloadAt already refuses a second reload without storage
	}
}

/** Vite fires `vite:preloadError` when a dynamic import fails; left alone, it throws. */
export const setupStaleChunkReload = (): void => {
	window.addEventListener('vite:preloadError', (event) => {
		const now = Date.now()
		if (!shouldReloadForStaleChunk(readLastReloadAt(), now)) return
		event.preventDefault()
		writeLastReloadAt(now)
		window.location.reload()
	})
}
