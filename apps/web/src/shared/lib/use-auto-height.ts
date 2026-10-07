import { type RefObject, useCallback, useEffect, useLayoutEffect } from 'react'

/**
 * Grows a textarea with its content; CSS max-height caps it and overflow scrolls beyond that
 * (docs: the composer grows up to 5 lines). Re-measures when the text or the field's width
 * changes (the composer widens the field for long text). Returns `resize` for uncontrolled typing.
 */
export const useAutoHeight = (
	ref: RefObject<HTMLTextAreaElement | null>,
	value: string | number | readonly string[] | undefined,
): (() => void) => {
	const resize = useCallback(() => {
		const element = ref.current
		if (!element) return
		// empty: stay one row — a long placeholder must not grow the field (it is truncated instead)
		if (element.value === '') {
			element.style.height = ''
			return
		}
		// reset first, otherwise scrollHeight never shrinks after deleting text
		element.style.height = 'auto'
		element.style.height = `${element.scrollHeight}px`
	}, [ref])

	// layout effect: measure before paint so the field never flashes at the wrong height
	useLayoutEffect(() => {
		resize()
	}, [resize, value])

	// the same text wraps differently at another width
	useEffect(() => {
		const element = ref.current
		if (!element) return
		let lastWidth = element.clientWidth
		const observer = new ResizeObserver(() => {
			if (element.clientWidth === lastWidth) return
			lastWidth = element.clientWidth
			resize()
		})
		observer.observe(element)
		return () => {
			observer.disconnect()
		}
	}, [ref, resize])

	return resize
}
