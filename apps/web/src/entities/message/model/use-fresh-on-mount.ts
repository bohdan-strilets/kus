import { useState } from 'react'

import { useFreshReplyStore } from './fresh-reply-store'

/**
 * Whether the card's reply arrived just now (`key` from `freshKey`). Fixed at mount: neither a
 * re-render nor the TTL running out flips it mid-animation, and a card mounted later (back in the
 * chat) reads false.
 */
export const useFreshOnMount = (key: string): boolean =>
	useState(() => useFreshReplyStore.getState().isFresh(key))[0]
