/** jsdom has no matchMedia (reduced-motion and viewport hooks call it): a stub that never matches. */
export const stubMatchMedia = (): void => {
	if (typeof window.matchMedia === 'function') return
	window.matchMedia = (query: string): MediaQueryList => ({
		matches: false,
		media: query,
		onchange: null,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
		addListener: () => undefined,
		removeListener: () => undefined,
		dispatchEvent: () => false,
	})
}
