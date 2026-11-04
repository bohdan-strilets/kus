import { type ReactNode, useMemo, useState } from 'react'

import { SwipeGroupContext } from './swipe-to-delete.context'

/** A list of swipe rows: only one of them is open at a time. */
export const SwipeGroup = ({ children }: { children: ReactNode }) => {
	const [openId, setOpenId] = useState<string | null>(null)
	const value = useMemo(() => ({ openId, setOpenId }), [openId])
	return <SwipeGroupContext value={value}>{children}</SwipeGroupContext>
}
