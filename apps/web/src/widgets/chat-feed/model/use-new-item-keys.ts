import { useState } from 'react'

import type { FeedItem } from './feed.types'

const EMPTY: ReadonlySet<string> = new Set()

/**
 * Items that arrived at the end since the last change — only they slide in (bubbleVariants).
 * The first render and older pages loaded on top appear as they are.
 */
export const useNewItemKeys = (items: readonly FeedItem[]): ReadonlySet<string> => {
	const [previous, setPrevious] = useState(items)
	const [newKeys, setNewKeys] = useState(EMPTY)

	// derived from the change itself, during render (CLAUDE.md §4)
	if (items !== previous) {
		const known = new Set(previous.map((item) => item.key))
		const lastKnown = items.findLastIndex((item) => known.has(item.key))
		setNewKeys(
			new Set(
				items
					.slice(lastKnown + 1)
					.filter((item) => !known.has(item.key))
					.map((item) => item.key),
			),
		)
		setPrevious(items)
	}
	return newKeys
}
