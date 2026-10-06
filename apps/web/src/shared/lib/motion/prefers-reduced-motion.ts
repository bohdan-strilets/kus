/** For imperative code outside React; components use Motion's `useReducedMotion`. */
export const prefersReducedMotion = (): boolean =>
	window.matchMedia('(prefers-reduced-motion: reduce)').matches
