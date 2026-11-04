import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import type { Ref } from 'react'

import { stepValueVariants } from '@/shared/lib'

interface StepValueProps {
	text: string
	/** +1 after «+», −1 after «−»: the number rolls that way. 0: a plain crossfade (a renumbered label). */
	direction: 1 | -1 | 0
}

interface StepTextProps extends StepValueProps {
	/** AnimatePresence `popLayout` takes the leaving number out of the flow through this ref. */
	ref?: Ref<HTMLSpanElement>
}

const StepText = ({ text, direction, ref }: StepTextProps) => {
	// the leaving number is only decoration: a screen reader reads the one live value
	const isPresent = useIsPresent()

	return (
		<motion.span
			ref={ref}
			variants={stepValueVariants}
			custom={direction}
			initial="hidden"
			animate="visible"
			exit="gone"
			aria-hidden={isPresent ? undefined : true}
			className="inline-block"
		>
			{text}
		</motion.span>
	)
}

/**
 * design/docs/motion.md «Живий режим» п. 4–5: a changed number rolls — the old one goes out, the
 * new one comes in 8 px from the side of the change, fast. The first text just shows. Reduced
 * motion keeps the opacity only (the root MotionConfig drops the shift).
 */
export const StepValue = ({ text, direction }: StepValueProps) => (
	<span className="relative inline-block">
		<AnimatePresence mode="popLayout" initial={false} custom={direction}>
			<StepText key={text} text={text} direction={direction} />
		</AnimatePresence>
	</span>
)
