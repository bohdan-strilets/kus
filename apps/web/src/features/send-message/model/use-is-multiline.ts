import { type RefObject, useCallback, useEffect, useState } from 'react'

/** Text that needs more than ~1.5 lines switches the composer to the expanded layout. */
const MULTILINE_FACTOR = 1.5
/** Not expanded. */
const COLLAPSED = -1

const doesTextWrap = (element: HTMLTextAreaElement): boolean => {
	const style = getComputedStyle(element)
	// scrollHeight includes the vertical padding (py-2 in the single-line layout)
	const contentHeight =
		element.scrollHeight -
		Number.parseFloat(style.paddingTop) -
		Number.parseFloat(style.paddingBottom)
	return contentHeight > Number.parseFloat(style.lineHeight) * MULTILINE_FACTOR
}

/**
 * Whether the composer should use the long-text layout (mockups/chat-long-input.html).
 * Wrapping counts only in the single-line layout: the expanded field is wider, so text that wraps
 * there may fit after expanding — measuring both would flip back and forth. It collapses again
 * when the text gets shorter than when it expanded, or empty (the placeholder never counts).
 *
 * Measured on every change (`measure` from onChange) and whenever the field resizes, which also
 * covers the first render.
 */
export const useIsMultiline = (
	ref: RefObject<HTMLTextAreaElement | null>,
	/** The controlled value: clearing it from outside (after sending) collapses without a resize. */
	value: string,
	/** false while the field is not rendered (voice mode); re-attaches the observer when it is back */
	isFieldShown: boolean,
) => {
	// the text length at the moment it expanded
	const [expandedAtLength, setExpandedAtLength] = useState(COLLAPSED)

	const measure = useCallback(() => {
		const element = ref.current
		if (!element) return
		const length = element.value.length
		setExpandedAtLength((current) => {
			if (length === 0) return COLLAPSED
			if (current !== COLLAPSED) return length < current ? COLLAPSED : current
			return doesTextWrap(element) ? length : COLLAPSED
		})
	}, [ref])

	useEffect(() => {
		const element = ref.current
		if (!isFieldShown || !element) return
		// also fires once right away, so pre-filled text is measured
		const observer = new ResizeObserver(measure)
		observer.observe(element)
		return () => {
			observer.disconnect()
		}
	}, [ref, measure, isFieldShown])

	return { isMultiline: value.length > 0 && expandedAtLength !== COLLAPSED, measure }
}
