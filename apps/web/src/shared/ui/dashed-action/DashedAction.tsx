import { motion } from 'motion/react'
import type { ReactNode, Ref } from 'react'

import { cn, PRESS } from '@/shared/lib'
import { Icon, ICON_SIZE } from '../icon'

interface DashedActionProps {
	children: ReactNode
	onClick: () => void
	isDisabled?: boolean
	className?: string
	ref?: Ref<HTMLButtonElement>
}

/** A dashed «+ …» button: «+ Вправа» in the editor and «Нова вправа «…»» in the search. */
export const DashedAction = ({
	children,
	onClick,
	isDisabled = false,
	className,
	ref,
}: DashedActionProps) => (
	<motion.button
		ref={ref}
		type="button"
		disabled={isDisabled}
		onClick={onClick}
		{...(isDisabled ? {} : PRESS)}
		className={cn(
			'flex min-h-button flex-none cursor-pointer items-center justify-center gap-1.5 rounded-button border-2 border-dashed border-line-strong text-body font-bold text-ink disabled:cursor-not-allowed disabled:opacity-50',
			className,
		)}
	>
		<Icon name="plus" size={ICON_SIZE.control} className="flex-none" />
		{children}
	</motion.button>
)
