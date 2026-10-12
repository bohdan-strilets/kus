import { useState } from 'react'

import { useFreshReplyStore } from './fresh-reply-store'

/**
 * Whether the meal's reply arrived just now. Fixed at mount: neither a re-render nor the TTL running
 * out flips it mid-animation, and a card mounted later (back in the chat) reads false.
 */
export const useFreshOnMount = (mealId: string): boolean =>
	useState(() => useFreshReplyStore.getState().isFresh(mealId))[0]
