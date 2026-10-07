import { useCallback, useSyncExternalStore } from 'react'

/** Live `matchMedia(query).matches`; false where matchMedia is missing (tests, old browsers). */
export const useMediaQuery = (query: string): boolean => {
	const subscribe = useCallback(
		(onChange: () => void) => {
			if (typeof window.matchMedia !== 'function') return () => undefined
			const list = window.matchMedia(query)
			list.addEventListener('change', onChange)
			return () => {
				list.removeEventListener('change', onChange)
			}
		},
		[query],
	)
	const getSnapshot = (): boolean =>
		typeof window.matchMedia === 'function' && window.matchMedia(query).matches

	return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

/** Touch is the primary input (phones, tablets): no physical keyboard to rely on. */
export const COARSE_POINTER_QUERY = '(pointer: coarse)'
