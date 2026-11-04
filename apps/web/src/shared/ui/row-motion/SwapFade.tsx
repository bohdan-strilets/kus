import { motion } from 'motion/react'
import { type ReactNode, useState } from 'react'

import { TRANSITION } from '@/shared/lib'

interface SwapFadeProps {
	/** Changes when the content is another thing (a block → a row): the new one fades in. */
	contentKey: string
	/** A function gets `hasSwapped`: true for what appeared by a swap, false for what was there from the start. */
	children: ReactNode | ((hasSwapped: boolean) => ReactNode)
}

/** What the row shows is swapped (the set block becomes a row): the new content fades in, base. The first one just shows. */
export const SwapFade = ({ contentKey, children }: SwapFadeProps) => {
	const [shownKey, setShownKey] = useState(contentKey)
	const [hasSwapped, setHasSwapped] = useState(false)
	if (contentKey !== shownKey) {
		setShownKey(contentKey)
		setHasSwapped(true)
	}

	return (
		<motion.div
			key={contentKey}
			initial={hasSwapped ? { opacity: 0 } : false}
			animate={{ opacity: 1 }}
			transition={TRANSITION.base}
		>
			{typeof children === 'function' ? children(hasSwapped) : children}
		</motion.div>
	)
}
