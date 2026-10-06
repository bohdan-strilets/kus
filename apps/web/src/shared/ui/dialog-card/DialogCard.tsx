import { type HTMLMotionProps, motion } from 'motion/react'

import { cn, TRANSITION } from '@/shared/lib'

export type DialogCardProps = HTMLMotionProps<'div'>

/**
 * The centred card of BaseModal and ConfirmDialog (docs Dialog / settings-delete-confirm):
 * surface, radius 28, shadow-dialog, padding 22 20 18, everything centred, fades in and out.
 * Rendered as the asChild of a Radix Content, which hands it ref and aria props.
 */
export const DialogCard = ({ className, ...props }: DialogCardProps) => (
	<motion.div
		className={cn(
			'pointer-events-auto flex w-full max-w-app flex-col items-center gap-3 rounded-sheet bg-surface px-5 pt-5.5 pb-4.5 text-center shadow-dialog focus-visible:outline-none',
			className,
		)}
		initial={{ opacity: 0 }}
		animate={{ opacity: 1, transition: TRANSITION.base }}
		exit={{ opacity: 0, transition: TRANSITION.exit }}
		{...props}
	/>
)
