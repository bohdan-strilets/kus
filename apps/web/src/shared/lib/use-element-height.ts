import { type RefCallback, useCallback } from 'react'

/**
 * A ref callback that reports the element's height (in px) while it is mounted and 0 when it goes:
 * a panel over scrolling content tells the content how much room to keep under it.
 */
export const useElementHeight = (onChange: (heightPx: number) => void): RefCallback<HTMLElement> =>
	useCallback(
		(element: HTMLElement | null) => {
			if (!element) return undefined
			onChange(element.offsetHeight)
			// no ResizeObserver (old WebViews, jsdom): the first measure has to do
			if (typeof ResizeObserver === 'undefined') {
				return () => {
					onChange(0)
				}
			}
			const observer = new ResizeObserver(() => {
				onChange(element.offsetHeight)
			})
			observer.observe(element)
			return () => {
				observer.disconnect()
				onChange(0)
			}
		},
		[onChange],
	)
