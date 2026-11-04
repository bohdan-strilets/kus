import { motion } from 'motion/react'
import { useState } from 'react'

import { stepValueVariants } from '@/shared/lib'

interface StepValueProps {
	text: string
	/** +1 after «+», −1 after «−»: the number rolls in from that side. */
	direction: 1 | -1
}

/** design/docs/motion.md «Живий режим» п. 5: a changed number comes in 8 px from the side of the change, fast. */
export const StepValue = ({ text, direction }: StepValueProps) => {
	const [shownText, setShownText] = useState(text)
	const [hasChanged, setHasChanged] = useState(false)
	if (text !== shownText) {
		setShownText(text)
		setHasChanged(true)
	}

	return (
		<motion.span
			key={text}
			variants={stepValueVariants}
			custom={direction}
			initial={hasChanged ? 'hidden' : false}
			animate="visible"
			className="inline-block"
		>
			{text}
		</motion.span>
	)
}
