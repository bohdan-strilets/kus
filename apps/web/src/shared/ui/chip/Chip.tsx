import { CheckIcon } from '@phosphor-icons/react'
import { type HTMLMotionProps, motion } from 'motion/react'
import type { ReactNode } from 'react'

import { cn, PRESS } from '@/shared/lib'

import { type ChipVariantProps, chipVariants } from './chip.variants'

const CHECK_ICON_SIZE = 14

export type ChipProps = Omit<ChipVariantProps, 'isSelected'> &
	Omit<HTMLMotionProps<'button'>, 'children'> & {
		children: ReactNode
		/** select chips only: toggled state, exposed as aria-pressed. */
		isSelected?: boolean
	}

export const Chip = ({
	variant = 'quick',
	isSelected = false,
	type = 'button',
	className,
	children,
	...props
}: ChipProps) => {
	const isToggle = variant === 'select'

	return (
		<motion.button
			type={type}
			aria-pressed={isToggle ? isSelected : undefined}
			className={cn(chipVariants({ variant, isSelected }), className)}
			{...(props.disabled ? {} : PRESS)}
			{...props}
		>
			{isToggle && isSelected && (
				<CheckIcon aria-hidden size={CHECK_ICON_SIZE} weight="bold" className="text-primary" />
			)}
			{children}
		</motion.button>
	)
}
