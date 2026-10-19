import { useCallback, useEffect, useRef } from 'react'

/**
 * A callback ref that reports the element's height whenever it changes (and once on mount).
 * The last reported value outlives the element: the caller keeps it.
 */
export const useMeasuredHeight = (
	onChange: (height: number) => void,
): ((element: HTMLElement | null) => void) => {
	const observerRef = useRef<ResizeObserver | null>(null)
	const onChangeRef = useRef(onChange)
	useEffect(() => {
		onChangeRef.current = onChange
	})
	useEffect(
		() => () => {
			observerRef.current?.disconnect()
		},
		[],
	)
	return useCallback((element: HTMLElement | null) => {
		observerRef.current?.disconnect()
		observerRef.current = null
		if (!element) return
		const report = (): void => {
			if (element.offsetHeight > 0) onChangeRef.current(element.offsetHeight)
		}
		report()
		const observer = new ResizeObserver(report)
		observer.observe(element)
		observerRef.current = observer
	}, [])
}
