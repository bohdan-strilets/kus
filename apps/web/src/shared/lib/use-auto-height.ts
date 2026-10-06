import { type RefObject, useCallback, useLayoutEffect } from 'react'

/**
 * Grows a textarea with its content; CSS max-height caps it and overflow scrolls beyond that
 * (docs: the composer grows up to 5 lines). Returns `resize` for uncontrolled typing.
 */
export const useAutoHeight = (
	ref: RefObject<HTMLTextAreaElement | null>,
	value: string | number | readonly string[] | undefined,
): (() => void) => {
	const resize = useCallback(() => {
		const element = ref.current
		if (!element) return
		// reset first, otherwise scrollHeight never shrinks after deleting text
		element.style.height = 'auto'
		element.style.height = `${element.scrollHeight}px`
	}, [ref])

	// layout effect: measure before paint so the field never flashes at the wrong height
	useLayoutEffect(() => {
		resize()
	}, [resize, value])

	return resize
}
