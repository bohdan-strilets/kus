import { createContext } from 'react'

export interface SwipeGroupValue {
	openId: string | null
	setOpenId: (id: string | null) => void
}

/** Without a group a row keeps its own open state. */
export const SwipeGroupContext = createContext<SwipeGroupValue | null>(null)
