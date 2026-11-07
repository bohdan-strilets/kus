/**
 * «Entry» is the first guard decision of this page lifetime (a full load or a PWA start). It cannot
 * be read from `location.key === 'default'`: the start URL `/` redirects to `/app/chat` (a new key)
 * before the protected guard renders. The latch lives outside React and is closed by the first
 * mounted guard after its first commit, so every later navigation is never an entry.
 */
let isEntryOver = false

export const isRouteEntry = (): boolean => !isEntryOver

export const markRouteEntryOver = (): void => {
	isEntryOver = true
}

/** For tests: a fresh page lifetime. */
export const resetRouteEntry = (): void => {
	isEntryOver = false
}
